const Libxml = require('node-libxml');
import { loadSchemaPEARL, EvaluationReport } from "evaluation-report-juezlti";
import fs from 'fs'
import path from 'path';



function perform(programmingExercise, evalReq, studentID) {
    return new Promise((resolve) => {
        loadSchemaPEARL().then(() => {

            let evalRes = new EvaluationReport();
            evalRes.setRequest(evalReq.request)
            let program = evalReq.request.program
            let isWrongAnswer = false;
            let response = {}
            response.report = {}
            response.report.capability = {
                "id": "XSD-evaluator",
                "features": [{
                    "name": "language",
                    "value": "XSD"
                }, {
                    "name": "version",
                    "value": "1.0"
                }, {
                    "name": "engine",
                    "value": "https://www.npmjs.com/package/node-libxml"
                }]
            }

            response.report.exercise = programmingExercise.id
            response.report.tests = []

            let solution_id = ""
            for (let solutions of programmingExercise.solutions) {
                if (solutions.lang.toUpperCase() == "XML") {
                    solution_id = solutions.id
                    break;
                }
            }
            const solution = programmingExercise.solutions_contents[solution_id]
            const xsd_name = `/student-XSD-schemas/student_${studentID}_${programmingExercise.id}.xsd`


            const xsd_file = path.join(__dirname, '../../public', xsd_name);

            fs.writeFile(xsd_file, program, async(err) => {

                try {
                    let libxml = new Libxml();
                    if (err) {
                        console.log(err)
                        throw err;
                    }
                    let isWrongAnswer = false;
                    for (let metadata of programmingExercise.tests) {
                        let current_in = programmingExercise.tests_contents_in[metadata.id];
                        let current_out = programmingExercise.tests_contents_out[metadata.id];
                        libxml.loadXmlFromString(current_in);



                        let testPEARinstance = {}
                        testPEARinstance.input = current_in
                        testPEARinstance.expectedOutput = current_out
                        testPEARinstance.mark = metadata.weight
                        testPEARinstance.visible = metadata.visible
                        testPEARinstance.feedback = ""
                        testPEARinstance.environmentValues = []
                        let validation_result = undefined;


                        libxml.loadSchemas([path.join(__dirname, '../../public', xsd_name)]);
                        validation_result = libxml.validateAgainstSchemas();

                        if (validation_result == null) {
                            throw "Compilation error"
                        }
                        testPEARinstance.obtainedOutput = `${Boolean(validation_result)}`


                        if (libxml.validationSchemasErrors != undefined) {
                            testPEARinstance.feedback = libxml.validationSchemasErrors[xsd_file][0].message
                        }
                        //todo
                        //In case of interest in supporting more than just a 'true' or 'false' string
                        //use improve the onlyLettersSpacesDots, otherwise the solution content needs to be exactly 'true' or 'false'.
                        //However be careful about security
                        //JSON.parse(toString(current_out).toLowerCase())
                        if(!onlyLettersSpacesDots(current_out)){
                            throw "The solution content needs to contain only letters or spaces"
                        }
                        if (eval(current_out)) {
                            testPEARinstance.classify = validation_result ? "Accepted" : "Wrong Answer"
                            if (!validation_result) {
                                isWrongAnswer = true;
                            }

                        } else {
                            testPEARinstance.classify = !validation_result ? "Accepted" : "Wrong Answer"
                            if (validation_result) {
                                isWrongAnswer = true;
                            }
                        }

                        response.report.tests.push(testPEARinstance)
                    }

                    evalRes.setReply(response)

                    evalRes.summary = {
                        "classify": (isWrongAnswer ? "Wrong Answer" : "Accepted"),
                        "feedback": ""
                    }

                    resolve(evalRes)
                } catch (e) {
                    response.report.tests = [];
                    evalRes.summary = {
                        "classify": "Compile Time Error",
                        "feedback": "Impossible to process the submit XSD"
                    }

                    console.log("**************ERROR****************")
                    console.log(e);
                    console.log("**************ERROR****************")
                    evalRes.setReply(response)
                    resolve(evalRes)

                } finally {
                    // Borrar el fichero creado
                    fs.unlink(xsd_file, (err) => {
                        if (err) {
                            console.error('Error al borrar el archivo:', err);
                        } else {
                            console.log('Archivo borrado exitosamente');
                        }
                    });
                }
            });
        })
    })
}

function onlyLettersSpacesDots(str) {
    return /^[a-zA-Z\s.,]+$/.test(str);
  }

module.exports = {
    perform
}
