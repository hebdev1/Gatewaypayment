import "server-only";
import QRCode from "qrcode";

export async function renderQrSvg(text: string, size = 240) {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: {
      dark: "#0b1220",
      light: "#ffffff"
    }
  });
}

export async function renderQrDataUrl(text: string, size = 480) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: { dark: "#0b1220", light: "#ffffff" }
  });
}
