const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');

class XMLUserParser {
  constructor(xmlPath) {
    this.xmlPath = xmlPath;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true
    });
  }

  async parse() {
    try {
      const xmlData = fs.readFileSync(this.xmlPath, 'utf8');
      const jsonData = this.parser.parse(xmlData);

      const result = {
        groups: [],
        students: [],
        teachers: [],
        nonTeachingStaff: []
      };

      // NOTE: XML tags are in Spanish as per source file specification
      // Tags: grupos, alumnos, docentes, no_docentes
      // Fields are XML attributes, not child nodes

      if (!jsonData.centro) {
        throw new Error('Invalid XML structure: missing <centro> root element');
      }

      const centro = jsonData.centro;

      // Parse groups (grupos)
      if (centro.grupos && centro.grupos.grupo) {
        result.groups = this.parseGroups(centro.grupos.grupo);
      }

      // Parse students (alumnos)
      if (centro.alumnos && centro.alumnos.alumno) {
        result.students = this.parseStudents(centro.alumnos.alumno);
      }

      // Parse teachers (docentes)
      if (centro.docentes && centro.docentes.docente) {
        result.teachers = this.parseTeachers(centro.docentes.docente);
      }

      // Parse non-teaching staff (no_docentes)
      if (centro.no_docentes && centro.no_docentes.no_docente) {
        result.nonTeachingStaff = this.parseNonTeachingStaff(centro.no_docentes.no_docente);
      }

      return result;
    } catch (error) {
      console.error('Error parsing XML:', error);
      throw new Error('No se pudo procesar el archivo XML: ' + error.message);
    }
  }

  parseGroups(groupsData) {
    const groups = [];
    const groupArray = Array.isArray(groupsData) ? groupsData : [groupsData];

    groupArray.forEach(group => {
      // XML attributes are prefixed with @_
      if (group && group['@_codigo'] && group['@_nombre']) {
        groups.push({
          code: group['@_codigo'],
          name: group['@_nombre']
        });
      }
    });

    return groups;
  }

  parseStudents(studentsData) {
    const students = [];
    const studentArray = Array.isArray(studentsData) ? studentsData : [studentsData];

    studentArray.forEach(student => {
      if (student) {
        students.push({
          first_name: student['@_nombre'] || '',
          last_name1: student['@_apellido1'] || '',
          last_name2: student['@_apellido2'] || '',
          birth_date: student['@_fecha_nac'] || null,
          document: student['@_documento'] || '',
          nia: student['@_NIA'] || null,
          group_code: student['@_grupo'] || null
        });
      }
    });

    return students;
  }

  parseTeachers(teachersData) {
    const teachers = [];
    const teacherArray = Array.isArray(teachersData) ? teachersData : [teachersData];

    teacherArray.forEach(teacher => {
      if (teacher) {
        teachers.push({
          first_name: teacher['@_nombre'] || '',
          last_name1: teacher['@_apellido1'] || '',
          last_name2: teacher['@_apellido2'] || '',
          birth_date: teacher['@_fecha_nac'] || null,
          document: teacher['@_documento'] || ''
        });
      }
    });

    return teachers;
  }

  parseNonTeachingStaff(staffData) {
    const staff = [];
    const staffArray = Array.isArray(staffData) ? staffData : [staffData];

    staffArray.forEach(person => {
      if (person) {
        staff.push({
          first_name: person['@_nombre'] || '',
          last_name1: person['@_apellido1'] || '',
          last_name2: person['@_apellido2'] || '',
          birth_date: person['@_fecha_nac'] || null,
          document: person['@_documento'] || ''
        });
      }
    });

    return staff;
  }
}

module.exports = XMLUserParser;
