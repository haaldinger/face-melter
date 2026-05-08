(() => {
  "use strict";

  /* ── DOM refs ── */
  const dropSource   = document.getElementById("dropSource");
  const dropTarget   = document.getElementById("dropTarget");
  const inputSource  = document.getElementById("inputSource");
  const inputTarget  = document.getElementById("inputTarget");
  const previewSrc   = document.getElementById("previewSource");
  const previewTgt   = document.getElementById("previewTarget");
  const threshold    = document.getElementById("threshold");
  const thresholdVal = document.getElementById("thresholdValue");
  const btnCompare   = document.getElementById("btnCompare");
  const resultsEl    = document.getElementById("results");
  const gaugeFill    = document.getElementById("gaugeFill");
  const gaugePct     = document.getElementById("gaugePct");
  const matchCards   = document.getElementById("matchCards");
  const rawJson      = document.getElementById("rawJson");
  const btnClear     = document.getElementById("btnClear");
  const toast        = document.getElementById("toast");

  let sourceFile = null;
  let targetFile = null;

  /* ── Helpers ── */
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove("hidden");
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 4000);
  }

  function updateButton() {
    btnCompare.disabled = !(sourceFile && targetFile);
  }

  function setPreview(file, previewEl, zoneEl) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewEl.style.backgroundImage = `url(${e.target.result})`;
      zoneEl.classList.add("has-image");
    };
    reader.readAsDataURL(file);
  }

  /* ── Drop-zone wiring ── */
  function wireZone(zone, input, previewEl, setter) {
    zone.addEventListener("click", () => input.click());

    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) { setter(f); setPreview(f, previewEl, zone); updateButton(); }
    });

    input.addEventListener("change", () => {
      const f = input.files[0];
      if (f) { setter(f); setPreview(f, previewEl, zone); updateButton(); }
    });
  }

  wireZone(dropSource, inputSource, previewSrc, (f) => { sourceFile = f; });
  wireZone(dropTarget, inputTarget, previewTgt, (f) => { targetFile = f; });

  /* ── Threshold slider ── */
  threshold.addEventListener("input", () => { thresholdVal.textContent = threshold.value; });

  /* ── Compare ── */
  btnCompare.addEventListener("click", async () => {
    if (!sourceFile || !targetFile) return;

    btnCompare.classList.add("loading");
    btnCompare.disabled = true;
    resultsEl.classList.add("hidden");

    const fd = new FormData();
    fd.append("source", sourceFile);
    fd.append("target", targetFile);
    fd.append("threshold", threshold.value);

    try {
      const res = await fetch("/api/compare", { method: "POST", body: fd });
      const data = await res.json();

      if (data.error) { showToast(data.error); return; }

      renderResults(data);
    } catch (err) {
      showToast("Network error – is the server running?");
    } finally {
      btnCompare.classList.remove("loading");
      updateButton();
    }
  });

  /* ── Render ── */
  function renderResults(data) {
    resultsEl.classList.remove("hidden");

    // Gauge
    const matches = data.FaceMatches || [];
    const topSim = matches.length > 0 ? matches[0].Similarity : 0;
    const pct = Math.round(topSim * 10) / 10;
    const circumference = 534.07;
    const offset = circumference - (circumference * pct / 100);
    gaugeFill.style.strokeDashoffset = offset;
    gaugeFill.style.stroke = pct >= 90 ? "var(--accent2)" : pct >= 70 ? "#f0c040" : "var(--danger)";
    gaugePct.textContent = pct + "%";

    // Cards
    matchCards.innerHTML = "";
    if (matches.length === 0) {
      matchCards.innerHTML = '<div class="no-matches">No face matches found above the threshold.</div>';
    } else {
      matches.forEach((m, i) => {
        const bb = m.Face?.BoundingBox;
        const bbStr = bb ? `Box: ${(bb.Left*100).toFixed(1)}%, ${(bb.Top*100).toFixed(1)}% — ${(bb.Width*100).toFixed(1)}% × ${(bb.Height*100).toFixed(1)}%` : "";
        const card = document.createElement("div");
        card.className = "match-card";
        card.style.animationDelay = `${i * 0.08}s`;
        card.innerHTML = `
          <div class="match-card__index">${i + 1}</div>
          <div class="match-card__details">
            <span class="match-card__similarity">${m.Similarity.toFixed(2)}% similarity</span>
            <span class="match-card__meta">${bbStr}</span>
          </div>`;
        matchCards.appendChild(card);
      });
    }

    // Raw JSON
    rawJson.textContent = JSON.stringify(data, null, 2);
  }

  /* ── Clear ── */
  btnClear.addEventListener("click", () => {
    resultsEl.classList.add("hidden");
    gaugeFill.style.strokeDashoffset = 534.07;
    gaugePct.textContent = "—";
    matchCards.innerHTML = "";
    rawJson.textContent = "";
  });
})();
