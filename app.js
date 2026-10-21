const invitation = document.querySelector("#invitation");
const cover = document.querySelector("#cover");
const film = document.querySelector("#film");
const opening = document.querySelector("#opening");
const main = document.querySelector("#main");
const audio = document.querySelector("#music");
const musicToggle = document.querySelector("#music-toggle");

let opened = false;
let openingStarted = false;
main.inert = true;

function revealInvitation() {
  if (opened) return;
  opened = true;
  film.classList.add("is-out");
  opening.pause();
  invitation.classList.add("ivx--revealed");
  main.setAttribute("aria-hidden", "false");
  main.inert = false;
  document.body.classList.remove("is-locked");
  window.setTimeout(() => {
    cover.classList.add("is-gone");
    film.classList.remove("is-in", "is-out");
  }, 850);
  observeReveals();
}

cover.addEventListener("click", () => {
  if (openingStarted || opened) return;
  openingStarted = true;
  cover.disabled = true;
  cover.classList.add("is-opening");
  film.classList.add("is-in");

  // Start audio directly in the click gesture so browsers that block
  // autoplay still allow playback after the visitor opens the invitation.
  audio.play().catch(() => {});
  opening.currentTime = 0;
  opening.play().catch(() => window.setTimeout(revealInvitation, 900));
});

opening.addEventListener("ended", revealInvitation);
opening.addEventListener("error", () =>
  window.setTimeout(revealInvitation, 900),
);

const observer =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries, currentObserver) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            if (entry.target.matches(".ivx-count")) {
              entry.target.classList.add("is-revealed");
            }
            currentObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
      )
    : null;

function observeReveals() {
  document
    .querySelectorAll(".ivx-reveal, .ivx-inview")
    .forEach((element, index) => {
      element.style.transitionDelay = `${Math.min(index * 90, 360)}ms`;
      if (observer) observer.observe(element);
      else element.classList.add("is-visible");
    });
}

const weddingDate = new Date("2026-11-23T16:00:00+05:00");
const countdown = document.querySelector("#countdown");
const finishedMessage = document.querySelector("#countdown-finished");
const countdownParts = Object.fromEntries(
  [...countdown.querySelectorAll("[data-part]")].map((node) => [
    node.dataset.part,
    node,
  ]),
);

function updateCountdown() {
  const remaining = Math.max(0, weddingDate.getTime() - Date.now());
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);

  countdownParts.days.textContent = String(days);
  countdownParts.hours.textContent = String(hours).padStart(2, "0");
  countdownParts.minutes.textContent = String(minutes).padStart(2, "0");
  countdownParts.seconds.textContent = String(seconds).padStart(2, "0");

  if (remaining === 0) {
    countdown.hidden = true;
    finishedMessage.hidden = false;
  }
}

updateCountdown();
window.setInterval(updateCountdown, 1000);

musicToggle.addEventListener("click", async () => {
  if (audio.paused) {
    try {
      await audio.play();
    } catch {
      return;
    }
  } else {
    audio.pause();
  }
  const playing = !audio.paused;
  musicToggle.classList.toggle("is-playing", playing);
  musicToggle.setAttribute("aria-pressed", String(playing));
  musicToggle.setAttribute(
    "aria-label",
    playing ? "Musiqani oʻchirish" : "Musiqani yoqish",
  );
});

audio.addEventListener("play", () => {
  musicToggle.classList.add("is-playing");
  musicToggle.setAttribute("aria-pressed", "true");
  musicToggle.setAttribute("aria-label", "Musiqani oʻchirish");
});

audio.addEventListener("pause", () => {
  musicToggle.classList.remove("is-playing");
  musicToggle.setAttribute("aria-pressed", "false");
  musicToggle.setAttribute("aria-label", "Musiqani yoqish");
});

const rsvpOpen = document.querySelector("#rsvp-open");
const rsvpForm = document.querySelector("#rsvp-form");
rsvpOpen.addEventListener("click", () => {
  rsvpOpen.hidden = true;
  rsvpForm.hidden = false;
  rsvpForm.querySelector("input").focus({ preventScroll: true });
});

rsvpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendMessage(rsvpForm, "rsvp", document.querySelector("#rsvp-status"));
});

document
  .querySelector("#wish-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const submitted = await sendMessage(form, "wish");
    if (!submitted) return;
    const item = document.createElement("li");
    item.className = "ivx-wish";
    const message = document.createElement("p");
    message.className = "ivx-wish__msg";
    message.textContent = values.get("message");
    const author = document.createElement("p");
    author.className = "ivx-wish__who";
    author.textContent = `— ${values.get("name")}`;
    item.append(message, author);
    document.querySelector("#wishes").prepend(item);
    form.reset();
  });

async function sendMessage(form, type, statusElement) {
  const submitButton = form.querySelector('[type="submit"]');
  const originalLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "Yuborilmoqda…";
  if (statusElement) statusElement.textContent = "";

  try {
    const values = new FormData(form);
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        name: values.get("name"),
        message: values.get("message"),
      }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Message could not be delivered.");
    }
    if (statusElement)
      statusElement.textContent = "Rahmat! Xabaringiz yuborildi.";
    form.reset();
    return true;
  } catch (error) {
    if (statusElement) {
      statusElement.textContent = error.message;
    } else {
      window.alert(error.message);
    }
    return false;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalLabel;
  }
}

document.querySelectorAll(".ivx-lang").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".ivx-lang").forEach((languageButton) => {
      const active = languageButton === button;
      languageButton.classList.toggle("is-active", active);
      languageButton.setAttribute("aria-pressed", String(active));
    });
    document.documentElement.lang = button.dataset.lang;
  });
});
