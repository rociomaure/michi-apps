<div align="center">

<img src="docs/icono.png" width="96" alt="Gatito naranjo de Michi Print">

# Michi Print

**Recortes de pantalla con un atajo y un cursor de patita con garrita.** ✂️🐾

[⬇️ Descargar para Windows](https://github.com/rociomaure/michi-apps/releases/latest) · [🖌️ Ver Michi Paint](../michi-paint/) · [💌 Volver a Michi Apps](../README.md)

</div>

## Lo que hace

- ✂️ **Recorta cualquier parte de la pantalla**: aprieta el atajo y dibuja un rectángulo con el mouse
- 🐾 Mientras recortas, el cursor es una **patita con garrita**
- 📋 El recorte queda copiado, listo para pegar en WhatsApp, Word, PowerPoint o donde quieras
- ⚡ Otro atajo **pega el último recorte** donde estés escribiendo
- 🐈 Vive como un gatito naranjo junto al reloj de Windows

## Atajos

| Atajo | Qué hace |
|---|---|
| `Ctrl` + `Shift` + `←` | Recortar (dibuja el rectángulo) |
| `Ctrl` + `Shift` + `→` | Pegar el último recorte |

¿Otro programa ya usa esa combinación? Clic derecho en el gatito → **Atajos de teclado** y elige otra (Ctrl+Alt, Alt+Shift…) o desactívalos. Si una combinación no está disponible, el gatito te avisa.

## Instalarlo

1. Descarga **Michi-Print-y-Paint-v2.0.zip** desde [Releases](https://github.com/rociomaure/michi-apps/releases/latest) (trae Michi Print y [Michi Paint](../michi-paint/))
2. Descomprime la carpeta **Michi** en un lugar fijo, por ejemplo `Documentos\Michi`
3. Doble clic en **MichiPrint.exe**. La primera vez te pregunta si quieres que se abra solo al encender el computador

> 💡 Como es una app nueva y sin firma comercial, Windows puede mostrar "Windows protegió su PC". Toca **Más información → Ejecutar de todas formas**.

## Pensada para que tu antivirus esté tranquilo

La versión 2.0 usa solo los atajos oficiales de Windows (`RegisterHotKey`): no lee tu teclado, no se instala sola ni se copia a otras carpetas, y partir con Windows es opcional.

## Cómo está hecho

C# con .NET 8 y Windows Forms. El código está en [`src/`](src/). Para compilarlo en Windows:

```
dotnet publish src/MichiPrint.csproj -c Release -r win-x64 --self-contained
```

## Contacto

💌 rocio.maure@gmail.com · [Más Michi Apps](https://github.com/rociomaure/michi-apps)

## Licencia

[MIT](../LICENSE) © 2026 Rocío Maure. 🐾
