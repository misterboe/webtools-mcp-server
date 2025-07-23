import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

dotenv.config({ path: path.join(process.cwd(), '.tests', '.env') });

describe('webtool_gethtml', () => {
  let client;
  let transport;
  let serverProcess;

  beforeAll(async () => {
    serverProcess = spawn('node', ['src/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: { ...process.env, LOG_LEVEL: 'silent' }
    });

    transport = new StdioClientTransport({
      command: 'node',
      args: ['src/index.js'],
      cwd: process.cwd(),
      env: { ...process.env, LOG_LEVEL: 'silent' }
    });

    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    await client.connect(transport);
  }, 30000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should fetch HTML content from TEST_URL with JavaScript execution and create resources', async () => {
    const testUrl = process.env.TEST_URL;
    expect(testUrl).toBeDefined();

    // 1. Test the tool call with JavaScript execution
    const result = await client.callTool({
      name: 'webtool_gethtml',
      arguments: {
        url: testUrl,
        ignoreSSLErrors: true,
        useJavaScript: true
      }
    });

    // Validate basic response structure
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Content Successfully Processed');
    expect(result.content[0].text).toContain('Source:');
    expect(result.content[0].text).toContain(testUrl);

    // 2. Save server response to tmp directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const responseFile = path.join('.tests', 'tmp', `server-response-${timestamp}.json`);
    await fs.writeFile(responseFile, JSON.stringify(result, null, 2));

    // 3. Extract resource URI from response
    const responseText = result.content[0].text;
    const resourceUriMatch = responseText.match(/`(web:\/\/[^`]+)`/);
    expect(resourceUriMatch).toBeTruthy();
    const resourceUri = resourceUriMatch[1];

    // 4. Test that we can list resources
    const resources = await client.listResources();

    expect(resources).toBeDefined();
    expect(Array.isArray(resources.resources)).toBe(true);
    expect(resources.resources.length).toBeGreaterThan(0);

    // Find our specific resource
    const ourResource = resources.resources.find(r => r.uri === resourceUri);
    expect(ourResource).toBeDefined();

    // 5. Read the resource content
    const resourceContent = await client.readResource({
      uri: resourceUri
    });

    expect(resourceContent).toBeDefined();
    expect(resourceContent.contents).toBeDefined();
    expect(Array.isArray(resourceContent.contents)).toBe(true);
    expect(resourceContent.contents.length).toBeGreaterThan(0);

    // 6. Save resource content to tmp directory
    const resourceFile = path.join('.tests', 'tmp', `resource-content-${timestamp}.json`);
    await fs.writeFile(resourceFile, JSON.stringify(resourceContent, null, 2));

    // If it's HTML content, also save the raw HTML
    if (resourceContent.contents[0].type === 'text' && resourceContent.contents[0].text.includes('<html')) {
      const htmlFile = path.join('.tests', 'tmp', `resource-content-${timestamp}.html`);
      await fs.writeFile(htmlFile, resourceContent.contents[0].text);
    }

    // 7. Save resources list to tmp directory
    const resourcesListFile = path.join('.tests', 'tmp', `resources-list-${timestamp}.json`);
    await fs.writeFile(resourcesListFile, JSON.stringify(resources, null, 2));

  }, parseInt(process.env.TEST_TIMEOUT) || 30000);
});