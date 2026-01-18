import { h } from 'vue'
import type { MattersRecord } from '~/lib/pocketbase-types';
import { type ColumnDef } from '@tanstack/vue-table';
import { CircleProgressBar } from 'vue3-m-circle-progress-bar';
import dayjs from 'dayjs';
import { CalendarIcon } from 'lucide-vue-next';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const columns: ColumnDef<MattersRecord>[] = [
    {
        accessorKey: 'name',
        header: () => h('div', { class: 'font-semibold ibm-plex-serif' }, 'Name'),
        cell: ({ row }) => {
            return h('a', { href: `/main/matters/matter/${row.original.id}`, class: 'font-semibold hover:text-primary hover:underline ibm-plex-serif' }, row.original.name);
        }
    },
    {
        accessorKey: 'caseNumber',
        header: () => h('div', { class: 'font-semibold ibm-plex-serif' }, 'Case Number'),
        cell: ({ row }) => {
            return h('div', { class: 'font-semibold' }, row.original.caseNumber);
        }
    },
    {
        accessorKey: 'completion',
        header: () => h('div', { class: 'font-semibold ibm-plex-serif' }, 'Completion'),
        cell: ({ row }) => {
            const deadlines = row.original.expand?.deadlines ?? [];
            const completed = deadlines.filter(d => d.completed === true).length;
            const total = deadlines.length;
            const completionRate = total === 0 ? 0 : Number(((completed / total) * 100).toFixed(1));

            return h('div', { class: 'font-semibold flex flex-row gap-1 items-center' }, [h(CircleProgressBar, { value: completionRate, max: 100, rounded: true, strokeWidth: 10, class: 'size-4' }), completionRate === 0 ? '-' : `${completionRate}%` ]);
        }
    },
    {
        accessorKey: 'nextDeadline',
        header: () => h('div', { class: 'font-semibold ibm-plex-serif' }, 'Next deadline'),
        cell: ({ row }) => {
            const nextDeadline = row.original.expand?.deadlines.filter(d => d.completed === false && d.missed === false).sort((d1, d2) => new Date(d1.date) - new Date(d2.date)).at(0);
            if(nextDeadline) {
                return h('div', { class: 'flex flex-row gap-1 items-center ibm-plex-serif' }, [h(CalendarIcon, { class: "size-4" }), dayjs(nextDeadline.date).format('D MMM YYYY'), ` ( ${dayjs(nextDeadline.date).fromNow()} )`]);
            }

            return '-';
        }

    },
    {
        accessorKey: 'members',
        header: () => h('div', { class: 'font-semibold ibm-plex-serif' }, 'Lawyers'),
        cell: ({ row }) => {
            const matter = row.original;

            return h('div', {
                class: 'flex flex-row -space-x-4 items-center ibm-plex-serif',
            }, [
                matter?.expand?.members?.map(m => {
                    return h('div', { class: 'size-8 border rounded-full text-xs bg-muted grid place-items-center text-muted-foreground' }, m?.name?.split(' ').map(n => n[0]).join(''))
                })
            ])

        }

    }
]