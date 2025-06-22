import type { NavMenu, NavMenuItems } from '~/types/nav'

export const navMenu: NavMenu[] = [
  {
    heading: 'General',
    items: [
      {
        title: 'Dashboard',
        icon: 'i-lucide-layout-dashboard',
        link: '/',
      },
      {
        title: 'Products',
        icon: 'i-lucide-shopping-bag',
        link: '/products',
        children: [
          {
            title: 'Products',
            link: '/products',
          },
          {
            title: 'Categories',
            link: '/products/categories',
          },
          {
            title: 'Groups',
            link: '/products/groups',
          },
          {
            title: 'Suppliers',
            link: '/products/suppliers',
          },
        ],
      },
      {
        title: 'Content Media',
        icon: 'i-lucide-folder',
        children: [
          {
            title: 'Folders',
            link: '/media',
          },
          {
            title: 'Trash',
            link: '/media/trash',
          },
        ],
      },
    ],
  },
]

export const navMenuBottom: NavMenuItems = [
  {
    title: 'Help & Support',
    icon: 'i-lucide-circle-help',
    link: 'https://github.com/dianprata/nuxt-shadcn-dashboard',
  },
  {
    title: 'Feedback',
    icon: 'i-lucide-send',
    link: 'https://github.com/dianprata/nuxt-shadcn-dashboard',
  },
]
