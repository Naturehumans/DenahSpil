import io
import csv
from typing import List
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from datetime import datetime

from app.models.equipment import Equipment

def generate_csv(equipments: List[Equipment]) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "Name", "Category", "Floor", "Brand", "Model", 
        "Installation Date", "Lifespan (Months)", "Expiry Date", "Status", "Notes"
    ])
    
    for eq in equipments:
        writer.writerow([
            eq.name,
            eq.category.name if eq.category else "-",
            eq.floor.name if eq.floor else "-",
            eq.brand or "-",
            eq.model_number or "-",
            eq.installation_date.isoformat() if eq.installation_date else "-",
            eq.lifespan_months,
            eq.expiry_date.isoformat() if eq.expiry_date else "-",
            eq.status,
            eq.notes or "-"
        ])
        
    return output.getvalue().encode('utf-8')

def generate_pdf(equipments: List[Equipment], title: str = "Equipment Report") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    normal_style = styles['Normal']
    
    # Header
    elements.append(Paragraph(title, title_style))
    elements.append(Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", normal_style))
    elements.append(Spacer(1, 12))
    
    # Table data
    data = [[
        "Name", "Category", "Floor", "Brand", 
        "Installation Date", "Expiry Date", "Status"
    ]]
    
    for eq in equipments:
        data.append([
            eq.name,
            eq.category.name if eq.category else "-",
            eq.floor.name if eq.floor else "-",
            eq.brand or "-",
            eq.installation_date.strftime('%Y-%m-%d') if eq.installation_date else "-",
            eq.expiry_date.strftime('%Y-%m-%d') if eq.expiry_date else "-",
            eq.status
        ])
        
    table = Table(data)
    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3a9542')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f0f3f7')),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ])
    table.setStyle(style)
    
    elements.append(table)
    
    # Build PDF
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes
