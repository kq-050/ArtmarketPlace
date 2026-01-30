const PDFDocument = require('pdfkit');
const fs = require('fs');

function createInvoice(invoice, path) {
    let doc = new PDFDocument({ margin: 50 });

    generateHeader(doc);
    generateCustomerInformation(doc, invoice);
    generateInvoiceTable(doc, invoice);
    generateFooter(doc);

    // Pipe the PDF into a writeable stream (file or response)
    doc.pipe(fs.createWriteStream(path));
    doc.end();
}

function generateHeader(doc) {
    doc
        .fillColor('#444444')
        .fontSize(20)
        .text('Art Marketplace Inc.', 50, 57)
        .fontSize(10)
        .text('123 Creative Blvd.', 200, 50, { align: 'right' })
        .text('New York, NY, 10025', 200, 65, { align: 'right' })
        .moveDown();
}

function generateCustomerInformation(doc, invoice) {
    doc
        .fillColor('#444444')
        .fontSize(20)
        .text('Invoice', 50, 160);

    generateHr(doc, 185);

    const customerInformationTop = 200;

    doc
        .fontSize(10)
        .text('Invoice Number:', 50, customerInformationTop)
        .font('Helvetica-Bold')
        .text(invoice.invoice_nr, 150, customerInformationTop)
        .font('Helvetica')
        .text('Invoice Date:', 50, customerInformationTop + 15)
        .text(new Date().toDateString(), 150, customerInformationTop + 15)
        .text('Balance Due:', 50, customerInformationTop + 30)
        .text('$' + invoice.total, 150, customerInformationTop + 30)

        .font('Helvetica-Bold')
        .text(invoice.shipping.name, 300, customerInformationTop)
        .font('Helvetica')
        .text(invoice.shipping.address, 300, customerInformationTop + 15)
        .text(invoice.shipping.city, 300, customerInformationTop + 30)
        .moveDown();

    generateHr(doc, 252);
}

function generateInvoiceTable(doc, invoice) {
    let i,
        invoiceTableTop = 330;

    doc.font('Helvetica-Bold');
    generateTableRow(
        doc,
        invoiceTableTop,
        'Item',
        'Unit Cost',
        'Quantity',
        'Line Total'
    );
    generateHr(doc, invoiceTableTop + 20);
    doc.font('Helvetica');

    for (i = 0; i < invoice.items.length; i++) {
        const item = invoice.items[i];
        const position = invoiceTableTop + (i + 1) * 30;
        generateTableRow(
            doc,
            position,
            item.title,
            '$' + item.price,
            1,
            '$' + item.price
        );

        generateHr(doc, position + 20);
    }
}

function generateFooter(doc) {
    doc
        .fontSize(10)
        .text(
            'Payment is due upon receipt. Thank you for your business.',
            50,
            780,
            { align: 'center', width: 500 }
        );
}

function generateTableRow(doc, y, item, unitCost, quantity, lineTotal) {
    doc
        .fontSize(10)
        .text(item, 50, y)
        .text(unitCost, 280, y, { width: 90, align: 'right' })
        .text(quantity, 370, y, { width: 90, align: 'right' })
        .text(lineTotal, 0, y, { align: 'right' });
}

function generateHr(doc, y) {
    doc
        .strokeColor('#aaaaaa')
        .lineWidth(1)
        .moveTo(50, y)
        .lineTo(550, y)
        .stroke();
}

module.exports = { createInvoice };