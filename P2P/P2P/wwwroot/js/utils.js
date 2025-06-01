// wwwroot/js/utils.js

function showAlert(message, type = 'info', duration = 5000) {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
        console.error("Alert container not found!");
        return;
    }

    alertContainer.style.display = "block"; // Ensure the container is visible when adding an alert

    const alertId = `alert-${Date.now()}`; // Unique ID for the alert

    const alertDiv = document.createElement('div');
    alertDiv.id = alertId;
    alertDiv.className = `alert alert-${type} alert-dismissible fade show d-flex align-items-center`;
    alertDiv.setAttribute('role', 'alert');

    let iconHtml = '';
    switch (type) {
        case 'success':
            iconHtml = '<i data-lucide="check-circle" class="me-2"></i>';
            break;
        case 'danger':
            iconHtml = '<i data-lucide="alert-triangle" class="me-2"></i>';
            break;
        case 'warning':
            iconHtml = '<i data-lucide="alert-circle" class="me-2"></i>';
            break;
        case 'info':
        default:
            iconHtml = '<i data-lucide="info" class="me-2"></i>';
            break;
    }

    alertDiv.innerHTML = `
        ${iconHtml}
        <div>${message}</div>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    alertContainer.appendChild(alertDiv);

    // Render Lucide icons within the alert
    lucide.createIcons({ parent: alertDiv });

    // Function to check if the container is empty
    function checkAndHideContainer() {
        if (alertContainer.children.length === 0) {
            alertContainer.style.display = "none";
        }
    }

    // Auto-dismiss after duration
    if (duration > 0) {
        setTimeout(() => {
            const alertElement = document.getElementById(alertId);
            if (alertElement) {
                const bsAlert = bootstrap.Alert.getOrCreateInstance(alertElement);
                if (bsAlert) {
                    bsAlert.close();
                } else {
                    // Fallback if bootstrap instance not found
                    alertElement.remove();
                }
                setTimeout(checkAndHideContainer, 500); // Wait for fade-out before checking
            }
        }, duration);
    }
}