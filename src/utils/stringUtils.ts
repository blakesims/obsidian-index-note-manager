export function toSnakeCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, '$1_$2') // Convert camelCase to snake_case
        .replace(/[\s-]+/g, '_') // Replace spaces and hyphens with underscores
        .toLowerCase(); // Convert to lowercase
} 