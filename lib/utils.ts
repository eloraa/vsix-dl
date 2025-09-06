import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts the package name from a VS Code marketplace URL
 * @param input - Either a URL or a package name
 * @returns The package name in format publisher.extension-name
 */
export function extractPackageName(input: string): string {
  const trimmedInput = input.trim();
  
  // If it's already in the correct format (contains a dot but not a URL), return as is
  if (trimmedInput.includes('.') && !trimmedInput.includes('://')) {
    return trimmedInput;
  }
  
  // Try to extract from URL
  try {
    const url = new URL(trimmedInput);
    
    // Check if it's a VS Code marketplace URL
    if (url.hostname === 'marketplace.visualstudio.com' && url.pathname === '/items') {
      const itemName = url.searchParams.get('itemName');
      if (itemName) {
        return itemName;
      }
    }
  } catch {
    // If URL parsing fails, treat it as a regular package name
  }
  
  // Return the input as-is if we can't extract anything
  return trimmedInput;
}

/**
 * Processes a list of inputs (URLs or package names) and extracts package names
 * @param input - Multi-line string with URLs or package names
 * @returns Array of package names
 */
export function extractPackageNames(input: string): string[] {
  return input
    .split('\n')
    .map(line => extractPackageName(line.trim()))
    .filter(name => name.length > 0);
}
