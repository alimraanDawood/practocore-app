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
        title: 'Documents',
        icon: 'i-lucide-book-text',
        link: '/products',
        children: [
          {
            title: 'Products',
            link: '/products',
          },
        ],
      },
      {
        title: 'Cases',
        icon: 'i-lucide-scale',
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
