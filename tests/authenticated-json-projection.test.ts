import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { authenticatedJsonProjection } from '../server/services/authenticated-json-projection';
let server: Server, origin: string;
beforeAll(async () => {
  const app=express();
  app.use((req,res,next)=>{
    authenticatedJsonProjection(req,res,
      request=>Boolean(request.user?.permissions?.includes('task_manager')) && !request.originalUrl.startsWith('/api/me/invoices'),
      body=>{ const {totalCost, ...visible}=body as Record<string,unknown>;return visible; });
    next();
  });
  // Production's requireAuth populates req.user in each protected route, after the global middleware.
  app.get(['/api/tasks/example','/api/me/invoices'],(req,res)=>{
    req.user={id:1,permissions:req.get('Test-Role') === 'ops' ? ['operations'] : ['task_manager']} as Express.User;
    res.json({hours:2,totalCost:100});
  });
  server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  origin=`http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async()=>{if(server) await new Promise<void>(resolve=>server.close(()=>resolve()));});
describe('financial projection after route authentication',()=>{
  it('filters using the identity populated by a later guard',async()=>{
    expect(await (await fetch(origin+'/api/tasks/example')).json()).toEqual({hours:2});
  });
  it('preserves authorized Operations responses',async()=>{
    expect(await (await fetch(origin+'/api/tasks/example',{headers:{'Test-Role':'ops'}})).json()).toEqual({hours:2,totalCost:100});
  });
  it('preserves the owner-only invoice response',async()=>{
    expect(await (await fetch(origin+'/api/me/invoices')).json()).toEqual({hours:2,totalCost:100});
  });
});
