import type { ExtractorOutlineNode } from "@shared/types/extractor";

export interface AnnotatedOutlineNode extends ExtractorOutlineNode {
  children: AnnotatedOutlineNode[];
  end: number | null;
  start: number | null;
}

interface WorkingOutlineNode extends AnnotatedOutlineNode {
  children: WorkingOutlineNode[];
  subtreeSize: number;
}

function withResolvedStart(
  node: ExtractorOutlineNode,
  resolveStart: (node: ExtractorOutlineNode) => number | null
): WorkingOutlineNode {
  const children = node.children.map((child) => withResolvedStart(child, resolveStart));
  const firstChildStart = children.find((child) => typeof child.start === "number")?.start ?? null;
  const ownStart = resolveStart(node);

  return {
    ...node,
    children,
    end: null,
    start: ownStart ?? firstChildStart,
    subtreeSize: 1 + children.reduce((total, child) => total + child.subtreeSize, 0)
  };
}

function flatten(nodes: WorkingOutlineNode[], target: WorkingOutlineNode[] = []) {
  for (const node of nodes) {
    target.push(node);
    flatten(node.children, target);
  }

  return target;
}

function stripWorkingFields(nodes: WorkingOutlineNode[]): AnnotatedOutlineNode[] {
  return nodes.map(({ subtreeSize: _subtreeSize, children, ...node }) => ({
    ...node,
    children: stripWorkingFields(children)
  }));
}

export function annotateOutlineRanges(
  nodes: ExtractorOutlineNode[],
  resolveStart: (node: ExtractorOutlineNode) => number | null,
  maxValue: number
) {
  const workingNodes = nodes.map((node) => withResolvedStart(node, resolveStart));
  const flatNodes = flatten(workingNodes);

  flatNodes.forEach((node, index) => {
    if (typeof node.start !== "number") {
      node.end = null;
      return;
    }

    const nextNode = flatNodes[index + node.subtreeSize];
    const rawEnd =
      typeof nextNode?.start === "number" ? Math.max(nextNode.start - 1, node.start) : maxValue;

    node.end = Math.max(node.start, rawEnd);
  });

  return stripWorkingFields(workingNodes);
}

export function flattenOutline(nodes: ExtractorOutlineNode[], target: ExtractorOutlineNode[] = []) {
  for (const node of nodes) {
    target.push(node);
    flattenOutline(node.children, target);
  }

  return target;
}

export function collectAnnotatedNodes(
  nodes: AnnotatedOutlineNode[],
  selectedIds: Set<string>,
  target: AnnotatedOutlineNode[] = []
) {
  for (const node of nodes) {
    if (selectedIds.has(node.id)) {
      target.push(node);
    }

    collectAnnotatedNodes(node.children, selectedIds, target);
  }

  return target;
}
