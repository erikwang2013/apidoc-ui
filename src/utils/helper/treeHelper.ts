export function treeToList<T = any>(tree: T[], childrenField = 'children') {
  const res: T[] = [] // 用于存储递归结果（扁平数据）
  // 递归函数
  const fn = (source: T[]) => {
    source.forEach((el) => {
      res.push(el)
      el[childrenField] && el[childrenField].length > 0 ? fn(el[childrenField]) : '' // 子级递归
    })
  }
  fn(tree)
  return res
}

export function filterTree<T = any>(
  tree: T[],
  func: (n: T) => boolean,
  childrenField = 'children',
): T[] {
  function listFilter(list: T[]) {
    return list
      .map((node: any) => ({ ...node }))
      .filter((node: any) => {
        node[childrenField] = node[childrenField] && listFilter(node[childrenField])
        return func(node) || (node[childrenField] && node[childrenField].length)
      })
  }

  return listFilter(tree)
}

export function getTreeValueByField<T = any>(
  tree: T[],
  field = 'menuKey',
  childrenField = 'children',
): string[] {
  const values: string[] = []
  function listFun(list: T[]) {
    for (let i = 0; i < list.length; i++) {
      const node: any = list[i]
      values.push(node[field])
      if (node[childrenField]) {
        listFun(node[childrenField])
      }
    }
  }
  listFun(tree)
  return values
}

export function getTreePath<T = any>(
  tree: T[],
  func: (n: T) => boolean,
  path: string[] = [],
  key = 'menuKey',
  childrenField = 'children',
): string[] {
  if (!tree) return []
  for (let i = 0; i < tree.length; i++) {
    const item: any = tree[i]
    path.push(item[key])
    if (func(item)) return path
    if (item[childrenField]) {
      const findChildren: any = getTreePath(item[childrenField], func, path, key, childrenField)
      if (findChildren.length) return findChildren
    }
    path.pop()
  }
  return []
}
