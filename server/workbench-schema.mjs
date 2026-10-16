// Generated from model.ts; SHA256 6c7a66f9400e55980d80ee1539c16db86c6c400f2cea55bf46297a298967da85
import { z } from "zod";
export const defaultHome = {
    date: true,
    greeting: true,
    description: true,
    summary: true,
    title: "",
    subtitle: "",
};
const text = z.string().max(120), id = z.string().regex(/^[\w-]{1,80}$/);
const nodeSchema = z.lazy(() => z.intersection(z
    .object({
    id,
    title: text,
    icon: z.string().regex(/^[a-z0-9-]{1,70}$/),
    hidden: z.boolean().optional(),
})
    .passthrough(), z.union([
    z
        .object({
        id,
        title: text,
        icon: text,
        hidden: z.boolean().optional(),
        type: z.literal("view"),
        kind: z.enum([
            "welcome",
            "notes",
            "files",
            "web",
            "system",
            "plugin",
            "app",
        ]),
        target: z.string().max(500).optional(),
    })
        .strict(),
    z
        .object({
        id,
        title: text,
        icon: text,
        hidden: z.boolean().optional(),
        type: z.literal("split"),
        axis: z.enum(["row", "column"]),
        ratio: z.number().min(0.15).max(0.85),
        children: z.array(nodeSchema).length(2),
    })
        .strict(),
    z
        .object({
        id,
        title: text,
        icon: text,
        hidden: z.boolean().optional(),
        type: z.literal("tabs"),
        active: id,
        children: z.array(nodeSchema).min(1).max(40),
    })
        .strict(),
    z
        .object({
        id,
        title: text,
        icon: text,
        hidden: z.boolean().optional(),
        type: z.literal("canvas"),
        children: z.array(nodeSchema).max(40),
        camera: z
            .object({
            x: z.number().min(-100000).max(100000),
            y: z.number().min(-100000).max(100000),
            zoom: z.number().min(0.25).max(2),
        })
            .strict(),
        rects: z.record(z
            .object({
            x: z.number().min(-100000).max(100000),
            y: z.number().min(-100000).max(100000),
            w: z.number().min(280).max(3000),
            h: z.number().min(240).max(3000),
        })
            .strict()),
    })
        .strict(),
])));
// Preflight before recursive schema parsing: imports must not exhaust the call stack.
export function validateWorkspace(value) {
    const raw = JSON.stringify(value);
    if (raw.length > 500000)
        throw Error("Layout exceeds 500 KB");
    const walk = (v, depth = 0) => {
        if (depth > 16)
            throw Error("Maximum nesting: 16");
        if (v && typeof v === "object") {
            for (const [key, child] of Object.entries(v)) {
                if (["__proto__", "prototype", "constructor"].includes(key))
                    throw Error("Unsafe property");
                if (child && typeof child === "object")
                    walk(child, depth + 1);
            }
        }
    };
    walk(value);
    const app = z
        .object({
        home: z
            .object({
            date: z.boolean(),
            greeting: z.boolean(),
            description: z.boolean(),
            summary: z.boolean(),
            title: z.string().max(120),
            subtitle: z.string().max(500),
        })
            .strict()
            .default(defaultHome),
        id,
        name: text.min(1),
        icon: z.string().regex(/^[a-z0-9-]{1,70}$/),
        template: text,
        theme: z.enum(["paper", "daylight", "graphite", "midnight"]),
        nav: z.enum(["side", "top", "bottom", "hidden"]),
        mobileNav: z.enum(["side", "top", "bottom", "hidden"]),
        chrome: z.boolean().default(true),
        brand: z.boolean(),
        logo: z.boolean(),
        brandName: text.default("Delta"),
        brandSymbol: z
            .string()
            .regex(/^[a-z0-9-]{1,70}$/)
            .default("delta"),
        root: nodeSchema,
        gap: z.number().int().min(8).max(32),
        radius: z.number().int().min(0).max(24),
        accent: z.string().regex(/^#[0-9a-f]{6}$/i),
    })
        .strict();
    const result = z
        .object({
        version: z.literal(1),
        active: id,
        apps: z.array(app).min(1).max(32),
    })
        .strict()
        .parse(value);
    const appIds = new Set(result.apps.map((a) => a.id));
    if (appIds.size !== result.apps.length || !appIds.has(result.active))
        throw Error("Invalid application ID");
    let count = 0;
    const ids = new Set();
    for (const a of result.apps)
        visit(a.root, (n) => {
            if (++count > 240 || ids.has(n.id))
                throw Error("Duplicate ID or too many components");
            ids.add(n.id);
            if (n.type === "tabs" && !n.children.some((c) => c.id === n.active))
                throw Error("Invalid active tab");
            if (n.type === "view" && n.kind === "app" && !appIds.has(n.target || ""))
                throw Error("Unknown application");
            if (n.type === "view" &&
                n.kind === "system" &&
                !/^\/(|console|fragments\/(?:heading|summary|dashboard)|plugins(?:\/[A-Za-z0-9_.%~-]{1,200})?|nodes(?:\/[A-Za-z0-9_.%~-]{1,200})?|events|dashboards(?:\/[A-Za-z0-9_.%~-]{1,200}(?:\/widgets\/[A-Za-z0-9_.%~-]{1,200})?)?|contracts|mcp|identity|access|settings)$/.test(n.target || ""))
                throw Error("Unknown system view");
            if (n.type === "view" &&
                n.kind === "plugin" &&
                !/^[\w.-]{1,100}(?:#[a-z-]{1,32})?$/.test(n.target || ""))
                throw Error("Invalid plugin ID");
        });
    const done = new Set();
    const follow = (appId, path) => {
        if (path.includes(appId))
            throw Error("Application cycle");
        if (done.has(appId))
            return;
        const a = result.apps.find((a) => a.id === appId);
        visit(a.root, (n) => {
            if (n.type === "view" && n.kind === "app")
                follow(n.target, [...path, appId]);
        });
        done.add(appId);
    };
    result.apps.forEach((a) => follow(a.id, []));
    return result;
}
export const uid = () => crypto.randomUUID();
export function visit(tree, fn) {
    fn(tree);
    if (tree.type !== "view")
        tree.children.forEach((c) => visit(c, fn));
}
export function mapTree(tree, id, fn) {
    if (tree.id === id)
        return fn(tree);
    return tree.type === "view"
        ? tree
        : { ...tree, children: tree.children.map((c) => mapTree(c, id, fn)) };
}
export function removeTree(tree, id) {
    if (tree.type === "view")
        return tree;
    let children = tree.children
        .filter((c) => c.id !== id)
        .map((c) => removeTree(c, id));
    if (!children.length)
        return {
            id: tree.id,
            title: tree.title,
            icon: "note",
            type: "view",
            kind: "notes",
        };
    if (tree.type === "split" && children.length === 1)
        return children[0];
    if (tree.type === "tabs")
        return {
            ...tree,
            children,
            active: children.some((c) => c.id === tree.active)
                ? tree.active
                : children[0].id,
        };
    return { ...tree, children };
}
export function cloneTree(n) {
    if (n.type === "view")
        return { ...n, id: uid() };
    const children = n.children.map(cloneTree);
    if (n.type === "canvas")
        return {
            ...n,
            id: uid(),
            children,
            rects: Object.fromEntries(children.map((c, i) => [
                c.id,
                n.rects[n.children[i].id] || {
                    x: 24 + i * 32,
                    y: 24 + i * 32,
                    w: 480,
                    h: 360,
                },
            ])),
        };
    return {
        ...n,
        id: uid(),
        children,
        ...(n.type === "tabs" ? { active: children[0].id } : {}),
    };
}
export const view = (kind, title, icon, target) => ({
    id: uid(),
    type: "view",
    kind,
    title,
    icon,
    ...(target ? { target } : {}),
});
