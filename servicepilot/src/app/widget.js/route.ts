const WIDGET_JS = `(function () {
  var script = document.currentScript;
  if (!script) {
    var list = document.querySelectorAll("script[data-business-id]");
    for (var i = 0; i < list.length; i++) {
      if (list[i].src && list[i].src.indexOf("/widget.js") > -1) {
        script = list[i];
        break;
      }
    }
    if (!script && list.length) script = list[0];
  }
  var businessId = script ? script.getAttribute("data-business-id") : null;
  if (!businessId) {
    console.error("[ServicePilot] widget.js: missing data-business-id");
    return;
  }
  var origin = "";
  try {
    origin = new URL(script.src).origin;
  } catch (e) {
    origin = "";
  }
  var color = (script && script.getAttribute("data-color")) || "#111827";

  var wrap = document.createElement("div");
  wrap.style.cssText =
    "position:fixed;bottom:20px;right:20px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;";

  var iframe = document.createElement("iframe");
  iframe.src = origin + "/embed/" + encodeURIComponent(businessId);
  iframe.title = "Chat";
  iframe.style.cssText =
    "display:none;border:none;width:380px;height:560px;max-width:calc(100vw - 40px);max-height:calc(100vh - 120px);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,0.18);background:#fff;margin-bottom:12px;";
  iframe.setAttribute("allow", "clipboard-write");

  var btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", "Open chat");
  btn.style.cssText =
    "width:56px;height:56px;border:none;border-radius:9999px;background:" +
    color +
    ";color:#fff;font-size:26px;line-height:1;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.22);display:flex;align-items:center;justify-content:center;";
  btn.innerHTML = "\uD83D\uDCAC";

  var open = false;
  function setOpen(v) {
    open = v;
    iframe.style.display = open ? "block" : "none";
    btn.innerHTML = open ? "\u2715" : "\uD83D\uDCAC";
    btn.setAttribute("aria-label", open ? "Close chat" : "Open chat");
  }
  btn.addEventListener("click", function () {
    setOpen(!open);
  });

  window.addEventListener("message", function (ev) {
    if (ev.origin !== origin) return;
    if (ev.data && ev.data.type === "servicepilot:close") setOpen(false);
  });

  wrap.appendChild(iframe);
  wrap.appendChild(btn);

  function mount() {
    document.body.appendChild(wrap);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
`;

export async function GET() {
  return new Response(WIDGET_JS, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
