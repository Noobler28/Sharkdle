(function () {
    const modal = document.getElementById("mode-rules-modal");
    if (!modal) return;

    let previousFocus = null;

    window.openModeRules = function () {
        if (!modal.hidden) return;
        previousFocus = document.activeElement;
        modal.hidden = false;
        modal.querySelector(".mode-rules-close")?.focus();
    };

    window.closeModeRules = function () {
        if (modal.hidden) return;
        modal.hidden = true;
        previousFocus?.focus?.();
    };

    modal.addEventListener("click", event => {
        if (event.target === modal) window.closeModeRules();
    });

    document.addEventListener("keydown", event => {
        if (modal.hidden) return;
        if (event.key === "Escape") {
            event.preventDefault();
            window.closeModeRules();
            return;
        }
        if (event.key !== "Tab") return;

        const focusable = [...modal.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])")]
            .filter(element => !element.hidden);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
})();
