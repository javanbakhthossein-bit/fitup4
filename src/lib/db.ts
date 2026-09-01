import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaVersion: string | undefined
}

// Bump this version whenever Prisma schema changes during dev — forces a new client.
const SCHEMA_VERSION = 'v15-body-comp'

// Detect stale client (missing new models) so we always rebuild after a schema change.
function isStaleClient(c: PrismaClient | undefined): boolean {
  if (!c) return true;
  const stale = !(c as any).siteSetting || !(c as any).article || !(c as any).termsVersion || !(c as any).headCode || !(c as any).checkup || !(c as any).userDiscountCode || !(c as any).otpCode || !(c as any).adminPermission || !(c as any).supportTicket || !(c as any).ticketReply || !(c as any).seoStrategy || !(c as any).seoArticlePlan || !(c as any).seoAgentRun || !(c as any).onboardingProfile || !(c as any).analysisResult || !(c as any).errorLog || !(c as any).feedback || !(c as any).pushSubscription;
  if (stale) {
    console.log('[db] stale client detected, will recreate. errorLog=', typeof (c as any).errorLog);
  }
  return stale;
}

export const db = (() => {
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaVersion === SCHEMA_VERSION &&
    !isStaleClient(globalForPrisma.prisma)
  ) {
    console.log('[db] reusing existing PrismaClient (version=', SCHEMA_VERSION, ')');
    return globalForPrisma.prisma;
  }
  console.log('[db] creating NEW PrismaClient (version=', SCHEMA_VERSION, ')');
  const client = new PrismaClient({ log: ['query'] });
  console.log('[db] new client checkup?', typeof (client as any).checkup, 'userDiscountCode?', typeof (client as any).userDiscountCode, 'otpCode?', typeof (client as any).otpCode);
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client
    globalForPrisma.prismaVersion = SCHEMA_VERSION
  }
  return client;
})();// touch
