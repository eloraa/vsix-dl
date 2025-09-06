'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText, Loader2, RefreshCw, Settings } from 'lucide-react';

export default function Home() {
  const [singleExtension, setSingleExtension] = useState('');
  const [version, setVersion] = useState('');
  const [extensionsList, setExtensionsList] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadingFile, setDownloadingFile] = useState('');
  const [cachedDownloads, setCachedDownloads] = useState<{[key: string]: {blob: Blob, filename: string}}>({});
  const [useCacheCheck, setUseCacheCheck] = useState(true);

  const downloadFileWithProgress = async (url: string, filename: string) => {
    try {
      // Check cache first if enabled
      if (useCacheCheck && cachedDownloads[filename]) {
        setMessage(`Found ${filename} in cache, using cached version`);
        redownloadCached(filename);
        return;
      }

      setDownloadProgress(0);
      setDownloadingFile(filename);
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      
      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength || '0', 10);
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to get response reader');
      
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        if (total > 0) {
          const progress = (receivedLength / total) * 100;
          setDownloadProgress(Math.round(progress));
        }
      }
      
      const blob = new Blob(chunks);
      
      // Cache the blob for redownload
      const cacheKey = filename;
      setCachedDownloads(prev => ({
        ...prev,
        [cacheKey]: { blob, filename }
      }));
      
      // Trigger download
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      setMessage('Download completed successfully!');
      setDownloadProgress(100);
    } catch (error) {
      setMessage('Download failed. Please try again.');
      console.error('Download error:', error);
    }
  };

  const redownloadCached = (cacheKey: string) => {
    const cached = cachedDownloads[cacheKey];
    if (!cached) return;
    
    const downloadUrl = URL.createObjectURL(cached.blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = cached.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
    
    setMessage(`Redownloaded ${cached.filename}`);
  };

  const clearCache = () => {
    setCachedDownloads({});
    setMessage('Download cache cleared');
  };

  const downloadSingle = async () => {
    if (!singleExtension) {
      setMessage('Please enter an extension name');
      return;
    }

    setIsDownloading(true);
    setMessage('Getting download information...');
    setDownloadProgress(0);

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          extension: singleExtension,
          version: version || undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessage('Starting download...');
        await downloadFileWithProgress(data.downloadUrl, data.filename);
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.error}`);
      }
    } catch {
      setMessage('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
      setDownloadingFile('');
      setTimeout(() => setDownloadProgress(0), 2000);
    }
  };

  const downloadMultiple = async () => {
    const extensions = extensionsList.split('\n').filter(ext => ext.trim());
    
    if (extensions.length === 0) {
      setMessage('Please enter at least one extension');
      return;
    }

    setIsDownloading(true);
    setMessage(`Downloading ${extensions.length} extensions...`);

    let successCount = 0;
    let failCount = 0;

    try {
      for (const extension of extensions) {
        const trimmedExt = extension.trim();
        if (!trimmedExt) continue;

        try {
          const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              extension: trimmedExt,
              version: version || undefined
            })
          });

          if (response.ok) {
            const data = await response.json();
            setMessage(`Downloading ${trimmedExt}...`);
            await downloadFileWithProgress(data.downloadUrl, data.filename);
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setMessage(`Download completed! Success: ${successCount}, Failed: ${failCount}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">VS Code Extension Downloader</h1>
          <p className="text-muted-foreground">Download VSIX packages from the VS Code Marketplace</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle>Cache Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="cache-check"
                  checked={useCacheCheck}
                  onChange={(e) => setUseCacheCheck(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="cache-check" className="text-sm">
                  Check cache before downloading (skip download if file already cached)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                When enabled, files already in cache will not be downloaded again and cached version will be used instead
              </p>
            </CardContent>
          </Card>

          <Tabs defaultValue="single" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Single Extension
              </TabsTrigger>
              <TabsTrigger value="multiple" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Multiple Extensions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single">
              <Card>
                <CardHeader>
                  <CardTitle>Download Single Extension</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="extension">Extension Name</Label>
                    <Input
                      id="extension"
                      placeholder="e.g., ms-python.python"
                      value={singleExtension}
                      onChange={(e) => setSingleExtension(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Format: publisher.extension-name
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="version">Version (optional)</Label>
                    <Input
                      id="version"
                      placeholder="e.g., 1.2.3 (leave empty for latest)"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <Button 
                    onClick={downloadSingle} 
                    disabled={isDownloading}
                    className="w-full"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Download Extension
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="multiple">
              <Card>
                <CardHeader>
                  <CardTitle>Download Multiple Extensions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="extensions-list">Extensions List</Label>
                    <Textarea
                      id="extensions-list"
                      placeholder={`ms-python.python\nms-vscode.vscode-typescript-next\nbradlc.vscode-tailwindcss`}
                      value={extensionsList}
                      onChange={(e) => setExtensionsList(e.target.value)}
                      className="mt-1 min-h-32"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter one extension per line in publisher.extension-name format
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="batch-version">Version (optional)</Label>
                    <Input
                      id="batch-version"
                      placeholder="e.g., 1.2.3 (leave empty for latest)"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <Button 
                    onClick={downloadMultiple} 
                    disabled={isDownloading}
                    className="w-full"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Download All Extensions
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {Object.keys(cachedDownloads).length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Cached Downloads</CardTitle>
                  <Button variant="outline" size="sm" onClick={clearCache}>
                    Clear Cache
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(cachedDownloads).map(([key, { filename, blob }]) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {(blob.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => redownloadCached(key)}
                        className="ml-3"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Redownload
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {message && (
            <Card className="mt-6">
              <CardContent className="pt-6">
                <p className={`text-center ${message.includes('Error') || message.includes('failed') ? 'text-destructive' : 'text-green-600'}`}>
                  {message}
                </p>
                {isDownloading && downloadProgress > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-muted-foreground mb-2">
                      <span>{downloadingFile && `Downloading: ${downloadingFile}`}</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${downloadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
