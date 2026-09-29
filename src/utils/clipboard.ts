import { toast } from 'sonner';

/**
 * Copies text to the clipboard with a resilient fallback for unsecured or iframe contexts,
 * notifying the user with a Sonner toast.
 */
export async function copyToClipboard(
  text: string,
  title: string = 'Copiado al portapapeles',
  description?: string
): Promise<boolean> {
  if (!text) return false;

  let success = false;

  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      success = true;
    } catch {
      // Proceed to fallback
    }
  }

  if (!success && typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();
      success = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch (err) {
      console.warn('Fallback copy failed:', err);
    }
  }

  if (success) {
    toast.success(title, description ? { description } : undefined);
  } else {
    toast.info('Texto para copiar', { description: text });
  }

  return success;
}
