export const HUB_CODE = process.env.HUB_CODE ?? 'ip2026'

export function checkCode(req: Request): boolean {
  return req.headers.get('x-hub-code') === HUB_CODE
}

export function unauthorized() {
  return Response.json({ error: 'Wrong passcode' }, { status: 401 })
}
