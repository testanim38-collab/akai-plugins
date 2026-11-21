export interface PasscodeRecord {
  salt: string
  hash: string
}

function digest(code: string, salt: string) {
  let a = 0x811c9dc5
  let b = 0x9e3779b9
  const input = `${salt}:${code}`
  for (let round = 0; round < 4096; round++) {
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i) + round
      a = Math.imul(a ^ c, 0x01000193) >>> 0
      b = Math.imul(b ^ (c + a), 0x85ebca6b) >>> 0
      b ^= b >>> 13
    }
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`
}

export function createRecord(code: string): PasscodeRecord {
  const salt = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  return { salt, hash: digest(code, salt) }
}

export function matches(code: string, record?: PasscodeRecord) {
  return !!record && digest(code, record.salt) === record.hash
}
