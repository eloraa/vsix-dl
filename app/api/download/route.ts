import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST with extension data.' }, { status: 405 });
}

export async function POST(request: NextRequest) {
  console.log('API route called');
  try {
    console.log('Parsing request body...');
    const { extension, version } = await request.json();
    console.log('Extension:', extension, 'Version:', version);
    
    if (!extension) {
      console.log('No extension provided');
      return NextResponse.json({ error: 'Extension name is required' }, { status: 400 });
    }

    const [publisher, extensionName] = extension.split('.');
    console.log('Publisher:', publisher, 'Extension name:', extensionName);
    
    if (!publisher || !extensionName) {
      console.log('Invalid extension format');
      return NextResponse.json({ error: 'Invalid extension format. Use publisher.extension-name' }, { status: 400 });
    }

    const apiUrl = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";
    console.log('Querying marketplace API...');
    
    const payload = {
      filters: [{
        criteria: [
          { filterType: 7, value: `${publisher}.${extensionName}` }
        ]
      }],
      flags: 914
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json;api-version=3.0-preview.1',
      'User-Agent': 'VSIX Downloader/1.0'
    };

    console.log('Making fetch request to marketplace...');
    const queryResponse = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    console.log('Marketplace response status:', queryResponse.status);

    if (!queryResponse.ok) {
      return NextResponse.json({ error: 'Failed to query VS Code Marketplace' }, { status: 500 });
    }

    const extensionData = await queryResponse.json();
    
    let extensionVersion = version;
    if (!extensionVersion) {
      try {
        extensionVersion = extensionData.results[0].extensions[0].versions[0].version;
      } catch {
        return NextResponse.json({ error: 'Extension not found' }, { status: 404 });
      }
    }

    const downloadUrl = `https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${extensionName}/${extensionVersion}/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`;

    return NextResponse.json({
      downloadUrl,
      filename: `${publisher}.${extensionName}-${extensionVersion}.vsix`,
      extension: `${publisher}.${extensionName}`,
      version: extensionVersion
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}