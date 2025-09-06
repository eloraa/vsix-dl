'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DownloadIcon, FileTextIcon, RefreshCwIcon, PauseIcon, PlayIcon, ExternalLinkIcon, PauseCircleIcon, CircleDashedIcon } from 'lucide-react';
import { cn, extractPackageName, extractPackageNames } from '@/lib/utils';

export default function Home() {
  const [singleExtension, setSingleExtension] = useState('');
  const [version, setVersion] = useState('');
  const [extensionsList, setExtensionsList] = useState('');
  const [, setMessage] = useState('');
  const [useCacheCheck, setUseCacheCheck] = useState(true);

  // Individual download items management
  const [downloadList, setDownloadList] = useState<{
    [downloadId: string]: {
      filename: string;
      progress: number;
      isPaused: boolean;
      controller?: AbortController;
      directDownloadUrl?: string;
      cached?: boolean;
      downloadUrl?: string;
      blob?: Blob;
      status: 'pending' | 'downloading' | 'completed' | 'failed';
    };
  }>({});

  const pausedRefs = useRef<{ [downloadId: string]: boolean }>({});

  // Cleanup effect for direct download URLs
  useEffect(() => {
    return () => {
      Object.values(downloadList).forEach(download => {
        if (download.directDownloadUrl) {
          URL.revokeObjectURL(download.directDownloadUrl);
        }
      });
    };
  }, [downloadList]);

  const downloadFileWithProgress = async (url: string, filename: string, autoDownload: boolean = true, downloadId?: string) => {
    // Generate unique download ID if not provided
    const id = downloadId || Date.now().toString();

    try {
      // Check cache first if enabled
      if (useCacheCheck) {
        const cachedItem = Object.values(downloadList).find(item => item.filename === filename && item.cached && item.blob);
        if (cachedItem && cachedItem.blob) {
          setMessage(`Found ${filename} in cache, using cached version`);
          redownloadCached(cachedItem.blob, filename);
          return;
        }
      }

      // Create new AbortController for this download
      const controller = new AbortController();
      pausedRefs.current[id] = false;

      // Update existing download item or create new one
      setDownloadList(prev => ({
        ...prev,
        [id]: {
          ...prev[id], // Keep existing properties if any
          filename,
          progress: 0,
          isPaused: false,
          controller,
          downloadUrl: url,
          status: 'downloading',
        },
      }));

      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('Download failed');

      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength || '0', 10);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to get response reader');

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        // Check if paused - use a ref to check current state
        while (pausedRefs.current[id] && !controller.signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (controller.signal.aborted) {
          // Remove from active downloads
          setDownloadList(prev => {
            const newDownloads = { ...prev };
            delete newDownloads[id];
            return newDownloads;
          });
          delete pausedRefs.current[id];
          return;
        }

        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        if (total > 0) {
          const progress = (receivedLength / total) * 100;
          // Update progress for this specific download
          setDownloadList(prev => ({
            ...prev,
            [id]: {
              ...prev[id],
              progress: Math.round(progress),
            },
          }));
        }

        // Small delay to allow pause state to be checked
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const blob = new Blob(chunks as BlobPart[]);

      // Cache the blob in download list
      setDownloadList(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          blob,
          cached: true,
        },
      }));

      if (autoDownload) {
        // Trigger download
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        setMessage(`${filename} downloaded successfully!`);
      } else {
        // Set direct download link for this specific download
        const downloadUrl = URL.createObjectURL(blob);
        setDownloadList(prev => ({
          ...prev,
          [id]: {
            ...prev[id],
            directDownloadUrl: downloadUrl,
          },
        }));
        setMessage(`Direct download link prepared for ${filename}!`);
      }

      // Update progress to 100% and mark as completed
      setDownloadList(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          progress: 100,
          status: 'completed',
        },
      }));

      setTimeout(() => {
        setDownloadList(prev => {
          const newDownloads = { ...prev };
          if (newDownloads[id] && !newDownloads[id].directDownloadUrl && !newDownloads[id].cached) {
            delete newDownloads[id];
          }
          return newDownloads;
        });
        if (!downloadList[id]?.cached) {
          delete pausedRefs.current[id];
        }
      }, 3000);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        setMessage(`Download cancelled: ${filename}`);
      } else {
        setMessage(`Download failed: ${filename}. Please try again.`);
        console.error('Download error:', error);
      }

      // Remove from active downloads
      setDownloadList(prev => {
        const newDownloads = { ...prev };
        delete newDownloads[id];
        return newDownloads;
      });
      delete pausedRefs.current[id];
    }
  };

  const redownloadCached = (blob: Blob, filename: string) => {
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    setMessage(`Redownloaded ${filename}`);
  };

  // const clearCache = () => {
  //   setDownloadList(prev => {
  //     const newList = { ...prev };
  //     Object.keys(newList).forEach(id => {
  //       if (newList[id].cached && newList[id].progress === 100) {
  //         delete newList[id];
  //       }
  //     });
  //     return newList;
  //   });
  //   setMessage('Download cache cleared');
  // };

  const pauseDownload = (downloadId: string) => {
    pausedRefs.current[downloadId] = true;
    setDownloadList(prev => ({
      ...prev,
      [downloadId]: {
        ...prev[downloadId],
        isPaused: true,
      },
    }));
    setMessage(`Download paused: ${downloadList[downloadId]?.filename}`);
  };

  const resumeDownload = (downloadId: string) => {
    pausedRefs.current[downloadId] = false;
    setDownloadList(prev => ({
      ...prev,
      [downloadId]: {
        ...prev[downloadId],
        isPaused: false,
      },
    }));
    setMessage(`Download resumed: ${downloadList[downloadId]?.filename}`);
  };

  const cancelDownload = (downloadId: string) => {
    const download = downloadList[downloadId];
    if (download?.controller) {
      download.controller.abort();
    }
    setMessage(`Download cancelled: ${download?.filename}`);
  };

  const clearDirectDownload = (downloadId: string) => {
    const download = downloadList[downloadId];
    if (download?.directDownloadUrl) {
      URL.revokeObjectURL(download.directDownloadUrl);
    }

    setDownloadList(prev => {
      const newDownloads = { ...prev };
      delete newDownloads[downloadId];
      return newDownloads;
    });
    delete pausedRefs.current[downloadId];
  };

  const getDirectDownloadLink = (downloadId: string) => {
    const download = downloadList[downloadId];
    if (!download) return;

    // Pause the current download
    pauseDownload(downloadId);

    setMessage(`Download paused. Opening direct link for ${download.filename}...`);
  };

  const downloadSingle = async () => {
    if (!singleExtension) {
      setMessage('Please enter an extension name or URL');
      return;
    }

    // Extract package name from URL if needed
    const packageName = extractPackageName(singleExtension);

    if (!packageName || !packageName.includes('.')) {
      setMessage('Please enter a valid extension name (publisher.extension-name) or marketplace URL');
      return;
    }

    // Add to download list immediately with pending status
    const downloadId = `single-${Date.now()}`;
    setDownloadList(prev => ({
      ...prev,
      [downloadId]: {
        filename: packageName, // Will be updated with actual filename
        progress: 0,
        isPaused: false,
        status: 'pending',
      },
    }));

    setMessage('Getting download information...');

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          extension: packageName,
          version: version || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update with actual filename and start download
        setDownloadList(prev => ({
          ...prev,
          [downloadId]: {
            ...prev[downloadId],
            filename: data.filename,
            status: 'downloading',
          },
        }));
        setMessage('Starting download...');
        await downloadFileWithProgress(data.downloadUrl, data.filename, true, downloadId);
      } else {
        const error = await response.json();
        // Update status to failed
        setDownloadList(prev => ({
          ...prev,
          [downloadId]: {
            ...prev[downloadId],
            status: 'failed',
          },
        }));
        setMessage(`Error: ${error.error}`);
      }
    } catch {
      // Update status to failed
      setDownloadList(prev => ({
        ...prev,
        [downloadId]: {
          ...prev[downloadId],
          status: 'failed',
        },
      }));
      setMessage('Download failed. Please try again.');
    }
  };

  const downloadMultiple = async () => {
    const extractedPackages = extractPackageNames(extensionsList);

    if (extractedPackages.length === 0) {
      setMessage('Please enter at least one extension name or URL');
      return;
    }

    const downloadIds: string[] = [];
    extractedPackages.forEach((packageName, index) => {
      if (packageName.includes('.')) {
        const downloadId = `batch-${Date.now()}-${index}`;
        downloadIds.push(downloadId);
        setDownloadList(prev => ({
          ...prev,
          [downloadId]: {
            filename: packageName,
            progress: 0,
            isPaused: false,
            status: 'pending',
          },
        }));
      }
    });

    setMessage(`Processing ${downloadIds.length} extensions...`);

    let successCount = 0;
    let failCount = 0;

    try {
      let validPackageIndex = 0;

      for (let i = 0; i < extractedPackages.length; i++) {
        const packageName = extractedPackages[i];

        if (!packageName.includes('.')) {
          failCount++;
          continue;
        }

        const downloadId = downloadIds[validPackageIndex];
        validPackageIndex++;

        try {
          const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              extension: packageName,
              version: version || undefined,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            // Update with actual filename and start download
            setDownloadList(prev => ({
              ...prev,
              [downloadId]: {
                ...prev[downloadId],
                filename: data.filename,
                status: 'downloading',
              },
            }));
            setMessage(`Downloading ${data.filename}...`);
            await downloadFileWithProgress(data.downloadUrl, data.filename, true, downloadId);
            successCount++;
          } else {
            // Update status to failed
            setDownloadList(prev => ({
              ...prev,
              [downloadId]: {
                ...prev[downloadId],
                status: 'failed',
              },
            }));
            failCount++;
          }
        } catch {
          // Update status to failed
          setDownloadList(prev => ({
            ...prev,
            [downloadId]: {
              ...prev[downloadId],
              status: 'failed',
            },
          }));
          failCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setMessage(`Download completed! Success: ${successCount}, Failed: ${failCount}`);
    } finally {
      // No need to change any global state
    }
  };

  return (
    <div className="size-full flex items-center justify-center overflow-hidden">
      <div className="mx-auto size-full flex items-center justify-center overflow-hidden min-h-0 max-h-full">
        <div className="max-w-sm md:max-h-[calc(100%-5rem)] overflow-hidden md:border flex flex-col">
          <Tabs defaultValue="single" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 border-b">
              <TabsTrigger value="single" className="flex items-center gap-2">
                <DownloadIcon className="h-4 w-4" />
                Single Extension
              </TabsTrigger>
              <TabsTrigger value="multiple" className="flex items-center gap-2">
                <FileTextIcon className="h-4 w-4" />
                Multiple Extensions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="!mb-0">
              <div className="space-y-4">
                <div className="px-2">
                  <Label htmlFor="extension">Extension Name or URL</Label>
                  <Input
                    id="extension"
                    placeholder="e.g., ms-python.python or https://marketplace.visualstudio.com/items?itemName=ms-python.python"
                    value={singleExtension}
                    onChange={e => setSingleExtension(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">Format: publisher.extension-name or VS Code marketplace URL</p>
                </div>

                <div className="px-2">
                  <Label htmlFor="version">Version (optional)</Label>
                  <Input id="version" placeholder="e.g., 1.2.3 (leave empty for latest)" value={version} onChange={e => setVersion(e.target.value)} className="mt-1" />
                </div>

                <div className="px-2">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="use-cache" checked={useCacheCheck} onChange={e => setUseCacheCheck(e.target.checked)} className="w-4 h-4" />
                    <Label htmlFor="use-cache" className="text-sm">
                      Use cache (skip download if already cached)
                    </Label>
                  </div>
                </div>

                <Button onClick={() => downloadSingle()} className="w-full !rounded-none cursor-pointer">
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Download Extension
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="multiple" className="!mb-0">
              <div className="space-y-4">
                <div className="px-2">
                  <Label htmlFor="extensions-list">Extensions List</Label>
                  <Textarea
                    id="extensions-list"
                    placeholder={`ms-python.python\nhttps://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools\nPrisma.prisma\nhttps://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss`}
                    value={extensionsList}
                    onChange={e => setExtensionsList(e.target.value)}
                    className="mt-1 min-h-32"
                  />
                  <p className="text-sm text-muted-foreground mt-1">Enter one extension per line: publisher.extension-name format or VS Code marketplace URLs</p>
                </div>

                <div className="px-2">
                  <Label htmlFor="batch-version">Version (optional)</Label>
                  <Input id="batch-version" placeholder="e.g., 1.2.3 (leave empty for latest)" value={version} onChange={e => setVersion(e.target.value)} className="mt-1" />
                </div>

                <div className="px-2">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="use-cache-batch" checked={useCacheCheck} onChange={e => setUseCacheCheck(e.target.checked)} className="w-4 h-4 rounded-none" />
                    <Label htmlFor="use-cache-batch" className="text-sm">
                      Use cache (skip download if already cached)
                    </Label>
                  </div>
                </div>

                <Button onClick={downloadMultiple} className="w-full !rounded-none cursor-pointer">
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Download All Extensions
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Downloads */}
          {Object.keys(downloadList).length > 0 && (
            <div className="overflow-hidden flex min-h-0">
              <div className="space-y-3 overflow-y-auto w-full">
                {Object.entries(downloadList).map(([downloadId, download]) => (
                  <div key={downloadId} className="p-2 border-b first:border-t">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="flex items-center gap-1">
                        {download.filename}
                        {download.status === 'pending' && (
                          <span className="text-blue-500 text-xs">
                            <span className="sr-only">(Pending...)</span>
                            <CircleDashedIcon className="size-4 animate-spin" />
                          </span>
                        )}
                        {download.isPaused && download.status === 'downloading' && (
                          <span className="text-orange-500">
                            <PauseCircleIcon className="size-4" />
                          </span>
                        )}
                        {download.status === 'failed' && <span className="text-red-500 text-xs">(Failed)</span>}
                      </span>
                      <span className="text-xs font-medium font-mono text-muted-foreground">{download.status === 'pending' ? 'Loading...' : `${download.progress}%`}</span>
                    </div>
                    <div className="w-full rounded-full h-1 mb-3 relative flex items-center">
                      {download.progress < 100 && <div className={cn('absolute inset-x-0 border-b-2 border-dotted -z-1', download.isPaused && 'border-orange-200')} />}
                      <div
                        className={cn(
                          'border-b-3 transition-all duration-300 border-pink-600',
                          download.isPaused && 'border-orange-600',
                          download.progress >= 100 && 'border-blue-600 h-auto border-dotted'
                        )}
                        style={{ width: `${download.progress}%` }}
                      ></div>
                    </div>

                    <div className="flex gap-2 justify-between items-center">
                      {download.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Fetching download info...</span>
                        </div>
                      )}

                      {download.status === 'downloading' && download.progress < 100 && (
                        <>
                          <div className="flex items-center gap-2">
                            {!download.isPaused ? (
                              <Button onClick={() => pauseDownload(downloadId)} variant="ghost" className="size-6" size="icon">
                                <PauseIcon className="size-4" fill="currentColor" strokeWidth="0" />
                                <span className="sr-only">Pause</span>
                              </Button>
                            ) : (
                              <Button onClick={() => resumeDownload(downloadId)} variant="ghost" className="size-6" size="icon">
                                <PlayIcon className="size-4" />
                                <span className="sr-only">Resume</span>
                              </Button>
                            )}
                            <button
                              onClick={() => cancelDownload(downloadId)}
                              className="text-sm text-muted-foreground cursor-pointer hover:text-destructive border-dashed px-0 py-0 h-auto leading-tight border-b border-destructive/10"
                            >
                              Cancel
                            </button>
                          </div>
                          {download.downloadUrl && (
                            <a
                              target="_blank"
                              href={download.downloadUrl}
                              onClick={() => getDirectDownloadLink(downloadId)}
                              className="flex items-center gap-1 text-sm text-muted-foreground cursor-pointer hover:text-foreground"
                            >
                              <ExternalLinkIcon className="mr-2 h-4 w-4" />
                              Get Direct Link
                            </a>
                          )}
                        </>
                      )}

                      {download.status === 'failed' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-500">Download failed</span>
                          <button
                            onClick={() => clearDirectDownload(downloadId)}
                            className="text-sm text-muted-foreground cursor-pointer hover:text-destructive border-dashed px-0 py-0 h-auto leading-tight border-b border-destructive/10"
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      {download.progress === 100 && download.cached && download.blob && (
                        <div className="flex items-center w-full justify-between">
                          <span className="text-xs font-mono font-medium">{((download.blob.size || 0) / 1024 / 1024).toFixed(2)} MB</span>
                          <div className="flex gap-2 items-center">
                            <Button variant="ghost" size="sm" onClick={() => download.blob && redownloadCached(download.blob, download.filename)} className="h-auto py-1 !px-1 cursor-pointer">
                              <RefreshCwIcon className="h-4 w-4 mr-1" />
                              Redownload
                            </Button>
                            <Button variant="ghost" size="sm" className="h-auto py-1 !px-1 cursor-pointer hover:text-destructive text-muted-foreground" onClick={() => clearDirectDownload(downloadId)}>
                              Clear
                            </Button>
                          </div>
                        </div>
                      )}

                      {download.directDownloadUrl && (
                        <div className="flex gap-2">
                          <Button asChild variant="default" size="sm">
                            <a href={download.directDownloadUrl} download={download.filename}>
                              <DownloadIcon className="h-4 w-4 mr-1" />
                              Download
                            </a>
                          </Button>
                          <Button onClick={() => clearDirectDownload(downloadId)} variant="outline" size="sm">
                            Clear
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
