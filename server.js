const express = require('express');
const path = require('path');
const cors = require('cors');
const PSD = require('psd');
const fs = require('fs');

const AdmZip = require('adm-zip');
const sharp = require('sharp');

// ⚙️ CONFIGURACIÓN: Cambia aquí el nombre del archivo PSD que quieres visualizar
const PSD_FILENAME = '02.psd';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.static('public'));
app.use('/psd', express.static(path.join(__dirname, 'psd')));

// Endpoint para listar archivos PSD disponibles
app.get('/api/psd-list', (req, res) => {
    try {
        const psdDir = path.join(__dirname, 'psd');
        const files = fs.readdirSync(psdDir)
            .filter(file => {
                // Solo archivos .psd con nombre numérico (01.psd, 02.psd, etc.)
                return file.endsWith('.psd') && /^\d+\.psd$/.test(file);
            })
            .sort((a, b) => {
                // Ordenar numéricamente
                const numA = parseInt(a.match(/\d+/)[0]);
                const numB = parseInt(b.match(/\d+/)[0]);
                return numA - numB;
            });

        res.json({ files });
    } catch (error) {
        console.error('Error listando archivos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para obtener la imagen del PSD como PNG
// Acepta parámetro ?file=nombre.psd
app.get('/api/psd-image', async (req, res) => {
    try {
        const filename = req.query.file || PSD_FILENAME;
        const psdPath = path.join(__dirname, 'psd', filename);

        if (!fs.existsSync(psdPath)) {
            return res.status(404).json({
                error: 'Archivo PSD no encontrado',
                file: filename
            });
        }

        console.log('Procesando PSD:', filename);

        // Usar PSD.open() que devuelve una promesa
        const psd = await PSD.open(psdPath);
        console.log('PSD abierto, generando PNG...');

        // Guardar temporalmente y leer el archivo
        const tempPath = path.join(__dirname, `temp-${Date.now()}.png`);
        await psd.image.saveAsPng(tempPath);

        console.log('PNG generado, enviando...');
        const imageBuffer = fs.readFileSync(tempPath);

        // Limpiar archivo temporal
        fs.unlinkSync(tempPath);

        res.set('Content-Type', 'image/png');
        res.send(imageBuffer);
    } catch (error) {
        console.error('Error procesando PSD:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

// Endpoint para exportar todos los PSD como JPG en un ZIP
app.get('/api/export-all', async (req, res) => {
    try {
        console.log('Iniciando exportación masiva...');
        const psdDir = path.join(__dirname, 'psd');

        // Obtener lista de archivos
        const files = fs.readdirSync(psdDir)
            .filter(file => file.endsWith('.psd') && /^\d+\.psd$/.test(file))
            .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)[0]);
                const numB = parseInt(b.match(/\d+/)[0]);
                return numA - numB;
            });

        if (files.length === 0) {
            return res.status(404).json({ error: 'No hay archivos PSD para exportar' });
        }

        const zip = new AdmZip();

        // Procesar cada archivo secuencialmente
        for (const filename of files) {
            console.log(`Exportando ${filename}...`);
            const psdPath = path.join(psdDir, filename);
            const tempPngPath = path.join(__dirname, `temp-export-${filename}.png`);

            try {
                // 1. Abrir PSD y guardar como PNG temporal
                const psd = await PSD.open(psdPath);
                await psd.image.saveAsPng(tempPngPath);

                // 2. Convertir PNG a JPG usando Sharp
                const jpgBuffer = await sharp(tempPngPath)
                    .jpeg({ quality: 90 }) // Calidad JPG al 90%
                    .toBuffer();

                // 3. Agregar al ZIP con el nombre cambiado a .jpg
                const jpgFilename = filename.replace('.psd', '.jpg');
                zip.addFile(jpgFilename, jpgBuffer);

                // 4. Limpiar PNG temporal
                if (fs.existsSync(tempPngPath)) {
                    fs.unlinkSync(tempPngPath);
                }
            } catch (err) {
                console.error(`Error procesando ${filename} para exportación:`, err);
                // Si falla uno, continuamos con el siguiente pero registramos el error
                // Opcional: Agregar un archivo de log de error al zip
                zip.addFile(`error-${filename}.txt`, Buffer.from(`Error: ${err.message}`));

                // Asegurar limpieza
                if (fs.existsSync(tempPngPath)) {
                    fs.unlinkSync(tempPngPath);
                }
            }
        }

        console.log('Generando archivo ZIP final...');
        const zipBuffer = zip.toBuffer();

        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename=psd-export.zip');
        res.set('Content-Length', zipBuffer.length);
        res.send(zipBuffer);
        console.log('Exportación completada y enviada.');

    } catch (error) {
        console.error('Error en exportación masiva:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para exportar todos los PSD como un único PDF
app.get('/api/export-pdf', async (req, res) => {
    try {
        const PDFDocument = require('pdfkit');
        console.log('Iniciando exportación a PDF...');
        const psdDir = path.join(__dirname, 'psd');

        // Obtener lista de archivos
        const files = fs.readdirSync(psdDir)
            .filter(file => file.endsWith('.psd') && /^\d+\.psd$/.test(file))
            .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)[0]);
                const numB = parseInt(b.match(/\d+/)[0]);
                return numA - numB;
            });

        if (files.length === 0) {
            return res.status(404).json({ error: 'No hay archivos PSD para exportar' });
        }

        // Crear documento PDF
        const doc = new PDFDocument({ autoFirstPage: false });

        // Configurar headers para descarga
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=psd-export.pdf');

        // Pipe el PDF directamente a la respuesta
        doc.pipe(res);

        // Procesar cada archivo secuencialmente
        for (const filename of files) {
            console.log(`Procesando ${filename} para PDF...`);
            const psdPath = path.join(psdDir, filename);
            const tempPngPath = path.join(__dirname, `temp-pdf-${filename}.png`);

            try {
                // 1. Abrir PSD y guardar como PNG temporal
                const psd = await PSD.open(psdPath);
                await psd.image.saveAsPng(tempPngPath);

                // 2. Obtener dimensiones de la imagen
                const metadata = await sharp(tempPngPath).metadata();

                // 3. Agregar página al PDF con el tamaño de la imagen
                doc.addPage({ size: [metadata.width, metadata.height] });

                // 4. Agregar la imagen a la página
                doc.image(tempPngPath, 0, 0, {
                    width: metadata.width,
                    height: metadata.height
                });

                // 5. Limpiar PNG temporal
                if (fs.existsSync(tempPngPath)) {
                    fs.unlinkSync(tempPngPath);
                }
            } catch (err) {
                console.error(`Error procesando ${filename} para PDF:`, err);
                // Si falla uno, continuamos con el siguiente
                // Asegurar limpieza
                if (fs.existsSync(tempPngPath)) {
                    try { fs.unlinkSync(tempPngPath); } catch (e) { }
                }
            }
        }

        // Finalizar el PDF
        doc.end();
        console.log('PDF generado y enviado.');

    } catch (error) {
        console.error('Error en exportación a PDF:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

app.listen(port, () => {
    console.log(`✨ PSD Viewer corriendo en http://localhost:${port}`);
});
