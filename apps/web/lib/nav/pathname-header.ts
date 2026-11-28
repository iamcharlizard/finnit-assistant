/**
 * proxy.ts copies the requested path into this request header, so server
 * layouts (which Next doesn't tell the path) can redirect by it.
 */
export const PATHNAME_HEADER = 'x-finnit-pathname';
