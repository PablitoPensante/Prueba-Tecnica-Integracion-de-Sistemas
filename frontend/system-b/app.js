const list = document.querySelector("#list");
const notice = document.querySelector("#notice");
const preview = document.querySelector("#previewDialog");
const reject = document.querySelector("#rejectDialog");
const reason = document.querySelector("#reason");
let documents = [];
let selected = null;

const esc = (value) => {
  const node = document.createElement("span");
  node.textContent = String(value);
  return node.innerHTML;
};
const subjectOf = (document) => document.subject?.trim() || "Sin asunto";
const typeOf = (url) => {
  const extension = new URL(url).pathname.split(".").pop().toLowerCase();
  if (extension === "pdf") return ["Documento PDF", true];
  if (["txt", "csv"].includes(extension)) return [extension === "csv" ? "Hoja de cálculo CSV" : "Documento de texto", true];
  if (["xls", "xlsx"].includes(extension)) return ["Hoja de cálculo", false];
  if (["doc", "docx"].includes(extension)) return ["Documento de texto", false];
  return ["Documento", false];
};

function render() {
  document.querySelector("#total").textContent = documents.length;
  document.querySelector("#pending").textContent = documents.filter((item) => item.status === "pending").length;
  document.querySelector("#resolved").textContent = documents.filter((item) => item.status !== "pending").length;
  list.innerHTML = documents.length
    ? documents.map((item) => `<div class="item"><div><strong>${esc(subjectOf(item))}</strong><small>${esc(item.thirdPartyEmail)}</small><small>${esc(item.documentId)}</small><small>${typeOf(item.fileUrl)[0]}${item.reason ? ` · ${esc(item.reason)}` : ""}</small></div><div><span class="badge ${item.status}">${item.status}</span><div class="actions"><button class="primary" data-review="${item.documentId}">Revisar documento</button><button class="danger" data-delete="${item.documentId}">Eliminar</button></div></div></div>`).join("")
    : `<div class="empty">No hay solicitudes para revisar.</div>`;
}

async function load() {
  try {
    const response = await fetch("/documents");
    documents = await response.json();
    render();
  } catch {
    show("No fue posible consultar las solicitudes", true);
  }
}

function show(message, isError = false) {
  notice.className = `notice${isError ? " error" : ""}`;
  notice.textContent = message;
}

function review(id) {
  selected = documents.find((item) => item.documentId === id);
  if (!selected) return;
  const [kind, inline] = typeOf(selected.fileUrl);
  document.querySelector("#fileKind").textContent = kind;
  document.querySelector("#previewTitle").textContent = subjectOf(selected);
  document.querySelector("#openExternal").href = selected.fileUrl;
  document.querySelector("#previewFrame").src = inline ? selected.fileUrl : "about:blank";
  document.querySelector("#previewFallback").style.display = inline ? "none" : "grid";
  document.querySelector("#decisionActions").style.display = selected.status === "pending" ? "flex" : "none";
  preview.showModal();
}

async function decide(status, rejectionReason) {
  try {
    const response = await fetch(`/documents/${selected.documentId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(rejectionReason ? { reason: rejectionReason } : {}) }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    preview.close();
    show(data.webhook.delivered ? "Decisión registrada y notificada." : "Decisión guardada; webhook pendiente.");
    await load();
  } catch (error) {
    show(error.message, true);
  }
}

list.addEventListener("click", async (event) => {
  const reviewButton = event.target.closest("[data-review]");
  const deleteButton = event.target.closest("[data-delete]");
  if (reviewButton) review(reviewButton.dataset.review);
  if (deleteButton && confirm("¿Eliminar esta solicitud de Sistema B?")) {
    const response = await fetch(`/documents/${deleteButton.dataset.delete}`, { method: "DELETE" });
    if (response.ok) await load();
  }
});

document.querySelector("#approveButton").onclick = () => decide("approved");
document.querySelector("#rejectButton").onclick = () => { reject.showModal(); reason.focus(); };
document.querySelector("#rejectForm").onsubmit = (event) => { event.preventDefault(); const value = reason.value.trim(); if (value) { reject.close(); decide("rejected", value); } };
reason.oninput = () => { document.querySelector("#count").textContent = reason.value.length; };
document.querySelector("#closePreview").onclick = () => preview.close();
document.querySelector("#closeReject").onclick = () => reject.close();
document.querySelector("#cancelReject").onclick = () => reject.close();

load();
setInterval(load, 5000);
