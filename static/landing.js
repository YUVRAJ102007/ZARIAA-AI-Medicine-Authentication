const tiltCards = document.querySelectorAll("[data-tilt]");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion) {
    tiltCards.forEach((card) => {
        const reset = () => {
            card.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0)";
        };

        card.addEventListener("mousemove", (event) => {
            const bounds = card.getBoundingClientRect();
            const x = (event.clientX - bounds.left) / bounds.width;
            const y = (event.clientY - bounds.top) / bounds.height;

            const rotateY = (x - 0.5) * 14;
            const rotateX = (0.5 - y) * 12;

            card.style.transform =
                `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`;
        });

        card.addEventListener("mouseleave", reset);
        card.addEventListener("blur", reset);
    });
}
