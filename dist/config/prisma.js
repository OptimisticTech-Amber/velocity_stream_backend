"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.getPrisma = getPrisma;
const client_1 = require("../generated/prisma/client");
let prismaInstance = null;
function initializePrisma() {
    if (!prismaInstance) {
        console.log("🔄 Initializing Prisma Client...");
        prismaInstance = new client_1.PrismaClient({
            log: ["error", "warn"], // Only log errors and warnings, not queries
        });
        console.log("✅ Prisma Client initialized");
    }
    return prismaInstance;
}
function getPrisma() {
    return initializePrisma();
}
// Lazy initialize via Proxy - this will only instantiate when first accessed
exports.prisma = new Proxy({}, {
    get(_target, prop) {
        const instance = initializePrisma();
        return instance[prop];
    },
});
