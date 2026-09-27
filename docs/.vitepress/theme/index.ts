import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import SchoolTable from './components/SchoolTable.vue'
import JluMajorTable from './components/JluMajorTable.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('SchoolTable', SchoolTable)
    app.component('JluMajorTable', JluMajorTable)
  }
} satisfies Theme
