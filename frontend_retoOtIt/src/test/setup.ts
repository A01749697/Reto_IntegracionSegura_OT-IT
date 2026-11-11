import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import i18n from '../idioma/i18n'

// Las pruebas esperan los textos en español, sin importar el idioma del navegador de prueba.
beforeEach(async () => {
  localStorage.removeItem('idioma')
  await i18n.changeLanguage('es')
})

// Sin esto, cada prueba deja su pantalla en el documento y las busquedas se mezclan.
afterEach(cleanup)
