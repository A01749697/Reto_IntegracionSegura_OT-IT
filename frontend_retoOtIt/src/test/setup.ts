import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sin esto, cada prueba deja su pantalla en el documento y las busquedas se mezclan.
afterEach(cleanup)
