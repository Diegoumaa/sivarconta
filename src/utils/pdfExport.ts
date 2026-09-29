import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Generates and downloads a high-resolution, pixel-perfect PDF of an HTML element
 * formatted specifically for El Salvador DTEs on standard Letter paper.
 */
export async function exportElementToPdf(
  elementId: string, 
  filename: string
): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id "${elementId}" not found for PDF export.`);
    return false;
  }

  try {
    // 1. Wait for document fonts to finish loading so glyphs and baselines are exact
    if (document.fonts) {
      await document.fonts.ready;
    }

    // 2. Temporarily store original styles and expand element to full natural height
    const originalMaxHeight = element.style.maxHeight;
    const originalOverflow = element.style.overflow;
    
    element.style.maxHeight = 'none';
    element.style.overflow = 'visible';

    // 3. Capture with html2canvas at scale 2.5 (retina quality)
    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1024,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          clonedElement.style.maxHeight = 'none';
          clonedElement.style.overflow = 'visible';
          // Ensure no clipping of text descenders in cloned DOM
          const allText = clonedElement.querySelectorAll('p, span, td, th, h1, h2, h3, div');
          allText.forEach((node) => {
            if (node instanceof HTMLElement) {
              node.style.overflow = 'visible';
              node.style.textOverflow = 'clip';
            }
          });
        }
      }
    });

    // Restore original styles
    element.style.maxHeight = originalMaxHeight;
    element.style.overflow = originalOverflow;

    // 4. Create Letter Portrait PDF (215.9mm x 279.4mm)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = 215.9;
    const pageHeight = 279.4;
    const margin = 10; // 10mm margins (~0.4 in)
    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    const imgData = canvas.toDataURL('image/png', 1.0);

    // If height fits on 1 page (standard DTEs under 12 items)
    if (contentHeight <= pageHeight - (margin * 2)) {
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight, '', 'FAST');
    } else {
      // Multi-page splitting if long catalog invoice
      let heightLeft = contentHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight, '', 'FAST');
      heightLeft -= (pageHeight - (margin * 2));

      while (heightLeft > 0) {
        position = heightLeft - contentHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight, '', 'FAST');
        heightLeft -= (pageHeight - (margin * 2));
      }
    }

    // 5. Download file
    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  }
}
