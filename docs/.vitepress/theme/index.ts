import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import SchoolTable from './components/SchoolTable.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('SchoolTable', SchoolTable)
  }
} satisfies Theme
