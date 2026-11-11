import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from './en'
import { es } from './es'
import { guardarIdioma, idiomaInicial, type Idioma } from './idiomas'

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: idiomaInicial(),
  fallbackLng: 'es',
  // los textos ya estan en el codigo y React escapa lo que pinta
  interpolation: { escapeValue: false },
  // sin esperar: los textos van incluidos, asi la primera pantalla ya sale traducida
  initAsync: false,
})

// El atributo lang ayuda a lectores de pantalla y al traductor del navegador.
const poner = (idioma: string) => {
  document.documentElement.lang = idioma
}
poner(i18n.language)
i18n.on('languageChanged', poner)

// Solo se guarda lo que la persona elige, no lo que adivinó el navegador.
export async function cambiarIdioma(idioma: Idioma): Promise<void> {
  guardarIdioma(idioma)
  await i18n.changeLanguage(idioma)
}

export default i18n
