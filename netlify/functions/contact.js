// Netlify Function: forwards contact form submissions to a private Telegram chat.
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ message: "Método no permitido." }) };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    // Honeypot: silently accept automated submissions without forwarding them.
    if (data.website) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    const fields = ["nombre", "telefono", "localidad", "servicio", "mensaje"];
    for (const field of fields) {
      if (typeof data[field] !== "string" || !data[field].trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ message: "Completá todos los campos obligatorios." }) };
      }
    }
    if (data.nombre.length > 100 || data.telefono.length > 40 ||
        data.localidad.length > 80 || data.servicio.length > 100 ||
        data.mensaje.length > 1500) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: "Revisá la longitud de los datos ingresados." }) };
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      console.error("Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en las variables de entorno.");
      return { statusCode: 503, headers, body: JSON.stringify({ message: "El formulario todavía no está configurado. Intentá más tarde." }) };
    }

    const message = [
      "📩 <b>Nueva consulta desde la web</b>",
      "",
      "<b>Nombre:</b> " + escapeHtml(data.nombre.trim()),
      "<b>Teléfono:</b> " + escapeHtml(data.telefono.trim()),
      "<b>Localidad:</b> " + escapeHtml(data.localidad.trim()),
      "<b>Servicio:</b> " + escapeHtml(data.servicio.trim()),
      "<b>Detalle:</b>",
      escapeHtml(data.mensaje.trim())
    ].join("\n");

    const telegramResponse = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" })
    });

    if (!telegramResponse.ok) {
      const errorBody = await telegramResponse.text();
      console.error("Telegram rechazó el envío:", errorBody);
      return { statusCode: 502, headers, body: JSON.stringify({ message: "No pudimos entregar tu consulta. Intentá nuevamente." }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error("Error procesando el formulario:", error);
    return { statusCode: 400, headers, body: JSON.stringify({ message: "No se pudo procesar el formulario." }) };
  }
};
