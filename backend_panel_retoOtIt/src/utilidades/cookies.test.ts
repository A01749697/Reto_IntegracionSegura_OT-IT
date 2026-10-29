import { describe, expect, it } from 'vitest'
import { crearCookieBorrada, crearCookieSesion, leerCookie } from './cookies'

describe('leerCookie', () => {
  it('devuelve undefined si no hay cabecera', () => {
    expect(leerCookie(undefined, 'sesion')).toBeUndefined()
    expect(leerCookie('', 'sesion')).toBeUndefined()
  })

  it('encuentra la cookie entre varias y quita los espacios', () => {
    expect(leerCookie('a=1; sesion=abc123;  b=2', 'sesion')).toBe('abc123')
  })

  it('busca el nombre exacto, sin confundirse con nombres parecidos', () => {
    expect(leerCookie('xsesion=falsa; sesion=buena', 'sesion')).toBe('buena')
    expect(leerCookie('xsesion=falsa', 'sesion')).toBeUndefined()
  })

  it('ignora partes sin signo igual y acepta valores vacíos', () => {
    expect(leerCookie('basura; sesion=abc', 'sesion')).toBe('abc')
    expect(leerCookie('sesion=', 'sesion')).toBe('')
  })

  it('no se rompe con un valor que contiene signos igual', () => {
    expect(leerCookie('sesion=ab=cd', 'sesion')).toBe('ab=cd')
  })
})

describe('crearCookieSesion', () => {
  const cookie = crearCookieSesion('__Host-sesion', 'abc123', 28800)

  it('lleva el nombre, el valor y la duración', () => {
    expect(cookie).toContain('__Host-sesion=abc123')
    expect(cookie).toContain('Max-Age=28800')
  })

  it('lleva todas las protecciones', () => {
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Path=/')
  })

  it('no lleva Domain (lo exige el prefijo __Host-)', () => {
    expect(cookie).not.toContain('Domain')
  })
})

describe('crearCookieBorrada', () => {
  it('vacía el valor y la caduca de inmediato, con las mismas protecciones', () => {
    const cookie = crearCookieBorrada('__Host-sesion')
    expect(cookie).toContain('__Host-sesion=;')
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Strict')
  })
})
