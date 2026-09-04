const key = "absign-system-a-documents";
const list = document.querySelector("#list");
const notice = document.querySelector("#notice");
let documents = JSON.parse(localStorage.getItem(key) || "[]");

const esc = (value) => {
  const node = document.createElement("span");
  node.textContent = String(value);
  return node.innerHTML;
};
const save = () => localStorage.setItem(key, JSON.stringify(documents));
const subjectOf = (document) => document.subject?.trim() || "Sin asunto";

function render() {
  document.querySelector("#total").textContent = documents.length;
  document.querySelector("#active").textContent = documents.filter((item) => ["pending", "sent"].includes(item.status)).length;
  document.querySelector("#resolved").textContent = documents.filter((item) => ["approved", "rejected"].includes(item.status)).length;
  list.innerHTML = documents.length
    ? documents.map((item) => `<div class="item"><div><strong>${esc(subjectOf(item))}</strong><small>${esc(item.thirdPartyEmail)}</small><small>${esc(item.id)}</small><small><a href="${esc(item.fileUrl)}" target="_blank" rel="noreferrer">Abrir documento</a>${item.reason ? ` · ${esc(item.reason)}` : ""}</small></div><div><span class="badge ${item.status}">${item.status}</span><div class="actions"><button class="danger" data-delete="${item.id}">Eliminar</button></div></div></div>`).join("")
    : `<div class="empty">Aún no hay documentos enviados.</div>`;
}

async function refresh() {
  documents = await Promise.all(documents.map(async (item) => {
    try {
      const response = await fetch(`/documents/${item.id}`);
      return response.ok ? await response.json() : item;
    } catch {
      return item;
    }
  }));
  save();
  render();
}

list.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button || !confirm("¿Eliminar este documento y su archivo?")) return;
  const id = button.dataset.delete;
  const response = await fetch(`/documents/${id}`, { method: "DELETE" });
  if (response.ok || response.status === 404) {
    documents = documents.filter((item) => item.id !== id);
    save();
    render();
  }
});

document.querySelector("#form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.querySelector("#submit");
  const data = new FormData(event.target);
  button.disabled = true;
  notice.innerHTML = "";
  try {
    const response = await fetch("/documents", { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "No se pudo enviar");
    documents.unshift(result);
    save();
    render();
    event.target.reset();
    notice.className = "notice";
    notice.textContent = "Documento subido y enviado correctamente.";
  } catch (error) {
    notice.className = "notice error";
    notice.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

render();
refresh();
setInterval(refresh, 8000);
