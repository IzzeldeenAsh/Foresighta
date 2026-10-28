import Swal from 'sweetalert2';

/**
 * Switching language reloads the page, so any edited form field is lost.
 * Angular marks edited controls `ng-dirty`, which covers project requests, offers and every other form.
 */
export async function confirmLanguageChange(currentLang: string): Promise<boolean> {
  if (typeof document === 'undefined') return true;
  if (!document.querySelector('form.ng-dirty, input.ng-dirty, textarea.ng-dirty, select.ng-dirty')) return true;

  const ar = currentLang === 'ar';
  const result = await Swal.fire({
    icon: 'warning',
    title: ar ? 'تغيير اللغة؟' : 'Change language?',
    text: ar
      ? 'لديك تغييرات غير محفوظة. تغيير اللغة سيعيد تحميل الصفحة وسيتم تجاهل المسودة الحالية.'
      : 'You have unsaved changes. Changing the language reloads the page and discards your current draft.',
    showCancelButton: true,
    confirmButtonText: ar ? 'تغيير اللغة وتجاهل المسودة' : 'Change and discard draft',
    cancelButtonText: ar ? 'إلغاء' : 'Cancel',
    reverseButtons: ar,
    focusCancel: true,
    buttonsStyling: false,
    customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-light me-3' },
  });
  return result.isConfirmed;
}
