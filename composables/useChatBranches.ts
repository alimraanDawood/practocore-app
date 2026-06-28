// useChatBranches — a small message-tree store powering conversation branching.
//
// The chat surface used to keep a flat `messages` array. Branching (editing an
// earlier user turn to explore an alternative reply, ChatGPT-style) needs a tree:
// editing a turn forks a sibling at that point, and each sibling keeps its own
// continuation. This composable holds that tree and projects the *active path*
// (the currently-selected branch) as a flat list, so the rest of the surface can
// keep treating `messages` as a linear conversation.
//
// Shape on the wire (persisted verbatim to AiConversations.tree, see services/ai):
//   { nodes: Record<id, BranchNode>, root: "__root__" }
// A virtual ROOT node owns the top-level turns so the very first turn can also have
// siblings without special-casing. `active` on each node indexes into its children
// to pick which branch is live.

import { computed, ref } from 'vue';

export const BRANCH_ROOT = '__root__';

export interface BranchNode<M> {
  id: string;
  /** The turn this node carries. The ROOT node's msg is null. */
  msg: M | null;
  parent: string;
  children: string[];
  /** Index into children selected on the active path. */
  active: number;
}

export interface SerializedTree<M> {
  nodes: Record<string, BranchNode<M>>;
  root: string;
}

export interface SiblingInfo {
  count: number;
  /** 0-based index of the active sibling. */
  current: number;
}

let _seq = 0;
function newId(): string {
  _seq += 1;
  return `n${Date.now().toString(36)}_${_seq.toString(36)}`;
}

export function useChatBranches<M extends object>() {
  function freshRoot(): Record<string, BranchNode<M>> {
    return { [BRANCH_ROOT]: { id: BRANCH_ROOT, msg: null, parent: '', children: [], active: 0 } };
  }

  const nodes = ref<Record<string, BranchNode<M>>>(freshRoot()) as {
    value: Record<string, BranchNode<M>>;
  };

  /** Ordered ids of the active path (excludes the virtual root). */
  const activeIds = computed<string[]>(() => {
    const path: string[] = [];
    let cur = nodes.value[BRANCH_ROOT];
    while (cur && cur.children.length) {
      const idx = Math.min(cur.active, cur.children.length - 1);
      const childId = cur.children[idx]!;
      path.push(childId);
      cur = nodes.value[childId];
    }
    return path;
  });

  /** The active branch projected as a flat list of messages. */
  const messages = computed<M[]>(() =>
    activeIds.value.map(id => nodes.value[id]!.msg as M),
  );

  function activeLeafId(): string {
    const ids = activeIds.value;
    return ids.length ? ids[ids.length - 1]! : BRANCH_ROOT;
  }

  /** Append a turn at the end of the active path. Returns the new node id. */
  function append(msg: M): string {
    const parentId = activeLeafId();
    const id = newId();
    nodes.value[id] = { id, msg, parent: parentId, children: [], active: 0 };
    const parent = nodes.value[parentId]!;
    parent.children.push(id);
    parent.active = parent.children.length - 1;
    return id;
  }

  /** Mutate the message object at active-path position `index` in place. */
  function patchAt(index: number, fn: (m: M) => void) {
    const id = activeIds.value[index];
    if (id && nodes.value[id]?.msg) fn(nodes.value[id]!.msg as M);
  }

  // Fork a sibling of the node at active-path `index` carrying `msg`, and make it
  // active. The active path now ends at the new (childless) sibling, so the caller
  // can resend from there. Used when the user edits an earlier turn.
  function fork(index: number, msg: M): string {
    const id = activeIds.value[index];
    if (!id) return append(msg);
    const parentId = nodes.value[id]!.parent;
    const parent = nodes.value[parentId]!;
    const nid = newId();
    nodes.value[nid] = { id: nid, msg, parent: parentId, children: [], active: 0 };
    parent.children.push(nid);
    parent.active = parent.children.length - 1;
    return nid;
  }

  /** Sibling count + active index for the node at active-path `index`. */
  function siblings(index: number): SiblingInfo {
    const id = activeIds.value[index];
    if (!id) return { count: 1, current: 0 };
    const parent = nodes.value[nodes.value[id]!.parent];
    if (!parent) return { count: 1, current: 0 };
    return { count: parent.children.length, current: parent.active };
  }

  /** Move the active sibling at active-path `index` by `dir` (wraps). */
  function switchSibling(index: number, dir: -1 | 1) {
    const id = activeIds.value[index];
    if (!id) return;
    const parent = nodes.value[nodes.value[id]!.parent];
    if (!parent || parent.children.length <= 1) return;
    const n = parent.children.length;
    parent.active = (parent.active + dir + n) % n;
  }

  // Remove the active leaf node (the last turn on the active path) and select its
  // previous sibling, if any. Used to drop a failed assistant turn before retrying.
  function popActive() {
    const ids = activeIds.value;
    if (!ids.length) return;
    const id = ids[ids.length - 1]!;
    const node = nodes.value[id]!;
    const parent = nodes.value[node.parent]!;
    parent.children = parent.children.filter(c => c !== id);
    parent.active = Math.max(0, Math.min(parent.active, parent.children.length - 1));
    delete nodes.value[id];
  }

  function reset() {
    nodes.value = freshRoot();
  }

  /** Rebuild a single-branch tree from a flat message list. */
  function loadFlat(msgs: M[]) {
    reset();
    for (const m of msgs) append(m);
  }

  /** Load a previously-serialized tree; falls back to empty on bad input. */
  function load(tree: SerializedTree<M> | null | undefined): boolean {
    if (tree && tree.nodes && tree.nodes[BRANCH_ROOT]) {
      nodes.value = tree.nodes;
      return true;
    }
    reset();
    return false;
  }

  function serialize(): SerializedTree<M> {
    return { nodes: nodes.value, root: BRANCH_ROOT };
  }

  return {
    messages,
    activeIds,
    append,
    patchAt,
    fork,
    siblings,
    switchSibling,
    popActive,
    reset,
    loadFlat,
    load,
    serialize,
  };
}
