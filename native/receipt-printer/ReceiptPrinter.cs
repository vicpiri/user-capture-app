// ReceiptPrinter - prints the orla receipts with the Windows text engine
//
// Chromium prints by turning the page into an image, and on a 203 dpi thermal
// printer its text came out with uneven, deformed strokes. GDI, the Windows
// text engine older applications print with, fits every character to the
// printer's dots, so even small text stays sharp; it is also faster.
//
// The app starts this program once and keeps it waiting. It reads one job per
// line on stdin, as JSON, and answers one line per job on stdout:
//   {"ready":true}                          once, when it is ready
//   {"id":1,"success":true}                 the job reached the print queue
//   {"id":1,"success":false,"error":"..."}  it did not
// A job with "previewFile" is drawn into that PNG instead of printed.
//
// Built with the C# compiler that comes with .NET Framework 4.x, part of every
// Windows 10 and 11, by scripts/build-receipt-printer.mjs.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Printing;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

class ReceiptPrinter
{
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();

    static int Main()
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        Console.InputEncoding = new UTF8Encoding(false);
        Answer(new Dictionary<string, object> { { "ready", true } });

        string line;
        while ((line = Console.In.ReadLine()) != null)
        {
            if (line.Trim().Length == 0) continue;
            object id = null;
            try
            {
                Dictionary<string, object> job = Json.Deserialize<Dictionary<string, object>>(line);
                job.TryGetValue("id", out id);
                Receipt receipt = new Receipt(job);
                string preview = Text(job, "previewFile");
                if (preview.Length > 0)
                {
                    Preview(receipt, preview);
                }
                else
                {
                    Print(receipt, Text(job, "printer"));
                }
                Answer(new Dictionary<string, object> { { "id", id }, { "success", true } });
            }
            catch (Exception error)
            {
                Answer(new Dictionary<string, object> { { "id", id }, { "success", false }, { "error", error.Message } });
            }
        }
        return 0;
    }

    static void Answer(Dictionary<string, object> answer)
    {
        Console.Out.WriteLine(Json.Serialize(answer));
        Console.Out.Flush();
    }

    static string Text(Dictionary<string, object> job, string key)
    {
        object value;
        return job.TryGetValue(key, out value) && value != null ? value.ToString() : "";
    }

    static void Print(Receipt receipt, string printer)
    {
        using (PrintDocument doc = new PrintDocument())
        {
            // An empty name leaves the default printer
            if (printer.Length > 0)
            {
                doc.PrinterSettings.PrinterName = printer;
            }
            if (!doc.PrinterSettings.IsValid)
            {
                throw new InvalidOperationException("La impresora «" + printer + "» no está instalada en este equipo");
            }
            doc.DocumentName = "Recibo de orla";
            doc.OriginAtMargins = false;
            doc.DefaultPageSettings.Margins = new Margins(0, 0, 0, 0);
            // Without this Windows Forms shows a "printing page 1" window
            doc.PrintController = new StandardPrintController();
            doc.PrintPage += (sender, e) =>
            {
                e.Graphics.PageUnit = GraphicsUnit.Pixel;
                receipt.Draw(e.Graphics, e.PageSettings.PrintableArea.Width / 100f * e.Graphics.DpiX);
                e.HasMorePages = false;
            };
            doc.Print();
        }
    }

    // Draws the receipt on a 203 dpi bitmap: for tests and layout checks.
    // On a bitmap GDI smooths the text, so it shows the layout, not the print.
    static void Preview(Receipt receipt, string file)
    {
        const float Dpi = 203f;
        float printable = 72f / 25.4f * Dpi;
        float height;
        using (Bitmap sizing = new Bitmap(1, 1))
        {
            sizing.SetResolution(Dpi, Dpi);
            using (Graphics g = Graphics.FromImage(sizing))
            {
                height = receipt.Draw(g, printable);
            }
        }
        using (Bitmap bitmap = new Bitmap((int)Math.Ceiling(printable), (int)Math.Ceiling(height)))
        {
            bitmap.SetResolution(Dpi, Dpi);
            using (Graphics g = Graphics.FromImage(bitmap))
            {
                g.Clear(Color.White);
                receipt.Draw(g, printable);
            }
            bitmap.Save(file, ImageFormat.Png);
        }
    }
}

// The receipt and its layout, which follows the HTML one of miscHandlers.js
class Receipt
{
    readonly string logoPath, centerName, subtitle, userName, groupName, date, price;
    readonly List<string> footerLines = new List<string>();

    public Receipt(Dictionary<string, object> job)
    {
        logoPath = Get(job, "logoPath");
        centerName = Get(job, "centerName");
        subtitle = Get(job, "subtitle");
        userName = Get(job, "userName");
        groupName = Get(job, "groupName");
        date = Get(job, "date");
        price = Get(job, "price");
        object lines;
        if (job.TryGetValue("footerLines", out lines) && lines is IEnumerable && !(lines is string))
        {
            foreach (object line in (IEnumerable)lines)
            {
                if (line != null && line.ToString().Trim().Length > 0) footerLines.Add(line.ToString().Trim());
            }
        }
    }

    static string Get(Dictionary<string, object> job, string key)
    {
        object value;
        return job.TryGetValue(key, out value) && value != null ? value.ToString() : "";
    }

    // Draws the receipt at the top of the page and returns its height, in dots
    public float Draw(Graphics g, float printableWidth)
    {
        g.PageUnit = GraphicsUnit.Pixel;
        float dpi = g.DpiY;
        Func<float, float> mm = v => v / 25.4f * dpi;
        // The HTML receipt is measured in CSS pixels, 96 to the inch
        Func<float, float> px = v => v / 96f * dpi;

        // 65 mm of text, centred in the printable width like the HTML body
        float width = Math.Min(mm(65), printableWidth);
        float left = (printableWidth - width) / 2f;
        float y = mm(5);

        if (logoPath.Length > 0 && File.Exists(logoPath))
        {
            y = DrawLogo(g, left, width, y, mm(50), mm(25), dpi) + px(10);
        }

        y = Lines(g, centerName, 16, true, 1.15f, left, width, y) + px(3);
        y = Lines(g, subtitle, 11, false, 1.15f, left, width, y) + px(12);
        y = Lines(g, userName, 13, true, 1.15f, left, width, y) + px(12);
        y = Lines(g, "Grupo: " + groupName, 11, false, 1.15f, left, width, y) + px(12);
        y = Lines(g, "Fecha:" + date, 10, false, 1.15f, left, width, y) + px(15);
        y = Lines(g, "Entrega: " + price + "€", 13, true, 1.15f, left, width, y) + px(15);

        // The footer's top border
        float border = Math.Max(2f, px(1));
        using (Brush black = new SolidBrush(Color.Black))
        {
            g.FillRectangle(black, left, y, width, border);
        }
        y += border + px(10);

        foreach (string line in footerLines)
        {
            y = Lines(g, line, 9, false, 1.4f, left, width, y) + px(6);
        }

        return y + mm(5);
    }

    // The logo at its own size, no larger than the box, like max-width and
    // max-height in the HTML one
    float DrawLogo(Graphics g, float left, float width, float y, float maxW, float maxH, float dpi)
    {
        using (Image logo = Image.FromFile(logoPath))
        {
            float naturalW = logo.Width / 96f * dpi, naturalH = logo.Height / 96f * dpi;
            float scale = Math.Min(1f, Math.Min(maxW / naturalW, maxH / naturalH));
            int w = Math.Max(1, (int)Math.Round(naturalW * scale));
            int h = Math.Max(1, (int)Math.Round(naturalH * scale));
            // Flattened onto white at the printer's size: printer drivers may
            // drop images with transparency, and the logo usually has it
            using (Bitmap flat = new Bitmap(w, h, PixelFormat.Format24bppRgb))
            {
                flat.SetResolution(dpi, dpi);
                using (Graphics fg = Graphics.FromImage(flat))
                {
                    fg.Clear(Color.White);
                    fg.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    fg.DrawImage(logo, 0, 0, w, h);
                }
                g.DrawImage(flat, left + (width - w) / 2f, y, w, h);
            }
            return y + h;
        }
    }

    // Draws text centred and wrapped to the width, one line at a time so the
    // line spacing matches the HTML receipt. Returns the y below it.
    static float Lines(Graphics g, string text, float points, bool bold, float lineHeight, float left, float width, float y)
    {
        if (text.Trim().Length == 0) return y;

        float dpi = g.DpiY;
        // TextRenderer sizes fonts as if the device were a 96 dpi screen;
        // unscaled, the text came out at half size on the 203 dpi printer
        using (Font font = new Font("Arial", points * dpi / 96f, bold ? FontStyle.Bold : FontStyle.Regular, GraphicsUnit.Point))
        {
            const TextFormatFlags Flags = TextFormatFlags.NoPadding | TextFormatFlags.SingleLine | TextFormatFlags.NoPrefix;
            float step = points / 72f * dpi * lineHeight;
            foreach (string line in Wrap(g, text, font, (int)width, Flags))
            {
                Size size = TextRenderer.MeasureText(g, line, font, new Size(int.MaxValue, int.MaxValue), Flags);
                int x = (int)Math.Round(left + (width - size.Width) / 2f);
                int top = (int)Math.Round(y + (step - size.Height) / 2f);
                TextRenderer.DrawText(g, line, font, new Point(x, top), Color.Black, Flags);
                y += step;
            }
        }
        return y;
    }

    static List<string> Wrap(Graphics g, string text, Font font, int width, TextFormatFlags flags)
    {
        List<string> lines = new List<string>();
        string current = "";
        foreach (string word in text.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries))
        {
            string candidate = current.Length == 0 ? word : current + " " + word;
            if (current.Length > 0 && TextRenderer.MeasureText(g, candidate, font, new Size(int.MaxValue, int.MaxValue), flags).Width > width)
            {
                lines.Add(current);
                current = word;
            }
            else
            {
                current = candidate;
            }
        }
        if (current.Length > 0) lines.Add(current);
        return lines;
    }
}
