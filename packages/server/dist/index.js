import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createHealthServer } from './health.js';
import { registerResources } from './resources.js';
import { registerTools } from './toolRegistry.js';
const server = new Server({
    name: 'vocalytics',
    version: '1.0.0',
}, {
    capabilities: {
        resources: {},
        tools: {},
    },
});
// Register resources and tools
registerResources(server);
registerTools(server);
async function main() {
    const PORT = Number(process.env.PORT || 3000);
    const health = createHealthServer('1.0.0');
    await health.listen({ port: PORT, host: '0.0.0.0' });
    console.error(`[health] http://localhost:${PORT}/health`);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Vocalytics MCP server running on stdio');
}
main().catch(console.error);
