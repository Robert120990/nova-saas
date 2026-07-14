import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useMemo } from 'react';
import iconMap from '../config/iconMap';

function normalize(item) {
    return {
        ...item,
        permission: item.permission_key,
        hideInMenu: !!item.hide_in_menu,
        icon: iconMap[item.icon] || iconMap.Circle,
        children: [],
    };
}

function buildTree(items) {
    const itemMap = {};
    const roots = [];

    items.forEach(item => {
        itemMap[item.id] = normalize(item);
    });

    items.forEach(item => {
        const normalized = itemMap[item.id];
        if (item.parent_id && itemMap[item.parent_id]) {
            itemMap[item.parent_id].children.push(normalized);
        } else if (!item.parent_id) {
            roots.push(normalized);
        }
    });

    return roots;
}

export function useMenuItems() {
    const { data: flatItems = [], isLoading } = useQuery({
        queryKey: ['menu-items'],
        queryFn: async () => {
            const res = await axios.get('/api/menu-items?active_only=true');
            return res.data;
        },
        staleTime: 30 * 60 * 1000,
    });

    const tree = useMemo(() => buildTree(flatItems), [flatItems]);

    const topLevelItems = useMemo(() => {
        return tree.filter(item => !item.parent_id && (!item.hide_in_menu) && item.path);
    }, [tree]);

    const menuConfig = useMemo(() => {
        return tree.filter(item => !item.parent_id && (!item.hide_in_menu) && (!item.path || item.children.length > 0));
    }, [tree]);

    return { topLevelItems, menuConfig, flatItems, isLoading };
}

function getRootParent(flatItems, item) {
    let current = item;
    let visited = new Set();
    while (current.parent_id) {
        if (visited.has(current.id)) break;
        visited.add(current.id);
        const parent = flatItems.find(i => i.id === current.parent_id);
        if (!parent) break;
        current = parent;
    }
    return current;
}

export function useMenuPermissions() {
    const { data: flatItems = [] } = useQuery({
        queryKey: ['menu-items'],
        queryFn: async () => (await axios.get('/api/menu-items?active_only=true')).data,
        staleTime: 30 * 60 * 1000,
    });

    return useMemo(() => {
        const groups = {};
        const seen = {};

        flatItems.forEach(item => {
            if (!item.permission_key) return;

            const root = getRootParent(flatItems, item);
            const groupId = root.id;
            if (!groups[groupId]) {
                groups[groupId] = {
                    id: groupId,
                    label: root.label,
                    icon: root.icon,
                    permissions: [],
                };
            }

            if (!seen[item.permission_key]) {
                seen[item.permission_key] = true;
                groups[groupId].permissions.push({ id: item.permission_key, label: item.label });
            }

            if (item.extra_permissions) {
                let extras = item.extra_permissions;
                if (typeof extras === 'string') {
                    try { extras = JSON.parse(extras); } catch (e) { extras = []; }
                }
                if (Array.isArray(extras)) {
                    extras.forEach(perm => {
                        if (!seen[perm]) {
                            seen[perm] = true;
                            groups[groupId].permissions.push({ id: perm, label: `${item.label} (${perm})` });
                        }
                    });
                }
            }
        });

        return Object.values(groups);
    }, [flatItems]);
}
