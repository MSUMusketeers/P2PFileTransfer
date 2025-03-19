// Site.js - Common JavaScript functions

// Smooth scrolling for anchor links
document.addEventListener("DOMContentLoaded", () => {
    const links = document.querySelectorAll('a[href^="#"]')

    for (const link of links) {
        link.addEventListener("click", function (e) {
            const href = this.getAttribute("href")

            if (href !== "#") {
                e.preventDefault()

                const target = document.querySelector(href)
                if (target) {
                    target.scrollIntoView({
                        behavior: "smooth",
                    })
                }
            }
        })
    }
})

