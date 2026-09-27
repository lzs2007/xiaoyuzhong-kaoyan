// 单校「可报考语种」专业清单 —— 通用数据类型
// 说明：各校专业目录版式不同，字段按可用性取舍；组件按字段是否存在自适应渲染。
//   opt     = 专业目录「②外国语」栏原文（含 202 俄语/203 日语可选表述）
//   num     = 招生人数（部分院校按专业给出，如吉林大学；哈工程按研究方向给出，见 dirsOk/dirsNo）
//   dirsOk  = 可选该语种的研究方向（可附人数）
//   dirsNo  = 同一专业中不可选该语种（仅英语）的研究方向（可附人数）
//   plan    = 招生计划/学习方式口径

export type Degree = '学硕' | '专硕' | ''

export interface MajorEntry {
  school: string
  major: string
  degree: Degree
  disc: string
  plan: string
  opt: string
  num?: string
  dirsOk?: string[]
  dirsNo?: string[]
}

export interface SchoolMeta {
  name: string
  slug: string
  year: string
  sourceName: string
  sourceUrl: string
  collectedAt: string
  verified: string
}
