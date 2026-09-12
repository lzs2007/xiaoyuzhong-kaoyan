import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  base: '/xiaoyuzhong-kaoyan/',
  title: '小语种考研信息网',
  description: '聚焦考研俄语202与日语203的非官方信息整理站，全部关键信息标注来源，以中国研究生招生信息网及招生单位当年官方公告为准。',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '俄语202专区', link: '/russian-202/' },
      { text: '日语203专区', link: '/japanese-203/' },
      { text: '院校名录', link: '/schools/' },
      { text: '政策公告', link: '/news/' },
      { text: '关于与免责声明', link: '/about' }
    ],
    sidebar: {
      '/russian-202/': [
        {
          text: '俄语202专区',
          items: [
            { text: '专区首页', link: '/russian-202/' }
          ]
        }
      ],
      '/japanese-203/': [
        {
          text: '日语203专区',
          items: [
            { text: '专区首页', link: '/japanese-203/' }
          ]
        }
      ]
    },
    search: {
      provider: 'local'
    },
    footer: {
      message: '本站为非官方信息整理站，不托管真题与大纲原文。所有信息以中国研究生招生信息网（yz.chsi.com.cn）及招生单位当年官方公告为准。',
      copyright: '内容仅供学习参考 | 转载官方信息均已标注来源与链接'
    },
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },
    lastUpdatedText: '最近更新',
    outline: {
      label: '本页目录'
    },
    returnToTopLabel: '回到顶部'
  }
})
