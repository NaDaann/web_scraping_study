//Biblioteca do google para realizar buscas
const google = require('googleapis').google;
const customsearch = google.customsearch('v1');

const googleSearchCredentials = require('../buscar_telefones/google-search.json');
//--------------------------------------------

//Biblioteca para formatar telefones
const parsePhoneNumber = require('libphonenumber-js').parsePhoneNumber;
//--------------------------------------------

//Conexão com o banco de dados
const Sequelize = require('sequelize');
const sequelize = new Sequelize('Seu banco de dados', 'Seu usuario de acesso', 'Sua senha', {
    host: 'Seu host',
    dialect: 'Dialeto do seu BD (mysql, postgres, etc)'
});
//--------------------------------------------

//Biblioteca que analisa os emails
const email_validator = require('email-validator');
const dns = require('dns');
//--------------------------------------------

//Biblioteca que abre o navegador em background
const puppeteer = require('puppeteer');
//--------------------------------------------

//Elementos que possam conter telefones ou emails
const elementos = ["p","h1","h2","h3","h4","h5","h6","div","span","a","input","textarea","select","option","button","label","legend","address","a", "li", "td", "div", "small"];
//--------------------------------------------

//Array que armazena os dados coletados
const array_dados = [];
//-----------------

//Valida a conexão com o banco de dados
sequelize.authenticate().then(function () {
    console.log("Conectado com sucesso!");
}).catch(function (erro) {
    console.log("Falha ao se conectar: " + erro);
});
//--------------------------------------------


String.prototype.removerDuplicatas = function() {
    //Converte a string em um array de caracteres
    const text = this.split(', ');
    
    //Filtra os telefones/emails unicos
    const uniqueChars = text.filter((char, index) => text.indexOf(char) === index);
    
    //Junta os telefones/emails unicos em uma string
    return uniqueChars.join(', '); 
}

async function Valida_telefone(text){
    return await new Promise(async function (resolve, reject) {
        /*
            --------------Explicação da regex----------------
            / e /g: As barras diagonais (/) são delimitadores usados para indicar o início e o fim da expressão regular. O g no final indica que a correspondência deve ser global, ou seja, todas as ocorrências na string devem ser encontradas, não apenas a primeira.

            \(?\d{2}\)?: Essa parte corresponde ao código de área do telefone. Explicando cada elemento:

                \( e \)?: O \( corresponde a um parêntese aberto "(" e \)? corresponde a um parêntese fechado ")" opcional. Isso permite que o código de área seja opcional e possa ser informado entre parênteses.
                \d{2}: O \d corresponde a qualquer dígito numérico de 0 a 9. O {2} indica que exatamente dois dígitos devem ser correspondidos. Portanto, essa parte corresponde a um código de área de dois dígitos.
                \s?: O \s corresponde a qualquer espaço em branco, incluindo espaços, tabulações e quebras de linha. O ? torna o espaço em branco opcional, permitindo que haja ou não um espaço após o código de área.
            
            
            \d{4,5}: Essa parte corresponde ao prefixo do número de telefone. O \d corresponde a qualquer dígito numérico e {4,5} indica que devem ser correspondidos de 4 a 5 dígitos. Isso permite que o prefixo tenha variações de comprimento.

            [- ]?: O [- ] corresponde a um hífen ou um espaço em branco. O ? torna o hífen ou o espaço em branco opcional, permitindo que seja usado ou não para separar o prefixo do sufixo do número.

            \d{4}: Essa parte corresponde ao sufixo do número de telefone. O \d corresponde a qualquer dígito numérico e {4} indica que exatamente quatro dígitos devem ser correspondidos.
        */
        
        const regex = /\(?\d{2}\)?\s?\d{4,5}[- ]?\d{4}/g;
        //--------------------------------------------

        const matches = text.match(regex);
        const phoneNumbers = new Set();
        
        if(matches) {
            for(let match of matches) {
                //Remove os espaços em branco e quebras de linha
                match = match.replaceAll(/\n|\s/gm,"");
                //--------------------------------------------

                //Formata o telefone e verifica se o mesmo é válido
                try{
                    const phoneNumber = parsePhoneNumber(match, 'BR');
                    if(phoneNumber.isValid()) {
                        const formattedPhoneNumber = phoneNumber.formatInternational();
                        phoneNumbers.add(formattedPhoneNumber);
                    }
                } catch(error){
                    console.log("\nTelefone inválido: ", match,'\n');
                }
                //--------------------------------------------
            }
        }
        
        //Junta os telefones em uma string separada por virgula
        let telefones_return = Array.from(phoneNumbers).join(', ');

        //Remove os telefones duplicados
        telefones_return = telefones_return.removerDuplicatas();
        
        //Retorna os telefones
        resolve(telefones_return);
    });
}

async function Valida_servidor_email(email) {
    return await new Promise(async function (resolve, reject) {
        const obj_return = { isValid: false, exists: false };

        //Valida o email
        const valid = email_validator.validate(email);
        if (!valid) {
            obj_return.isValid = false;
            obj_return.exists = false;
        }
        //--------------------------------------------
    
        const domain = email.split('@')[1];
        try {
            //Verifica se o servidor do email existe. A verificação é feita através do MX do email
            await dns.promises.resolveMx(domain);
            obj_return.isValid = true;
            obj_return.exists = true;
            //--------------------------------------------
        } catch (err) {
            if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
                obj_return.isValid = true;
                obj_return.exists = false;
            }
        }

        //Retorna o objeto com o resultado da validação
        resolve([obj_return]);
    });
}

async function Valida_email(str){
    return await new Promise(async function (resolve, reject) {
        const emailsValidos = [];

        /**
         * --------------Explicação da regex----------------
            / e /g: As barras diagonais (/) são delimitadores usados para indicar o início e o fim da expressão regular. O g no final indica que a correspondência deve ser global, ou seja, todas as ocorrências de endereços de e-mail na string devem ser encontradas, não apenas a primeira.

            \b: Esse é um caractere especial chamado de limite de palavra, que corresponde a uma fronteira entre um caractere alfanumérico (letra ou número) e um caractere não alfanumérico (espaço, ponto, vírgula, etc.). Isso é usado para garantir que o padrão de e-mail seja correspondido como uma palavra inteira e não parte de uma palavra.

            [A-Za-z0-9._%+-]+: Essa parte corresponde ao nome do usuário do endereço de e-mail. Explicando cada elemento:

                [A-Za-z0-9._%+-]: Isso define um conjunto de caracteres permitidos para o nome do usuário. Inclui letras maiúsculas e minúsculas (de A a Z e de a a z), dígitos numéricos (de 0 a 9) e alguns caracteres especiais permitidos em um endereço de e-mail, como ponto (.), sublinhado (_), porcentagem (%) e os caracteres de adição (+) e hífen (-).
                
                +: O sinal de mais indica que o conjunto de caracteres pode ocorrer uma ou mais vezes. Isso permite que o nome do usuário do endereço de e-mail tenha mais de um caractere.
            
            
            @: Isso corresponde ao caractere "@" que separa o nome do usuário do domínio no endereço de e-mail.

            [A-Za-z0-9.-]+: Essa parte corresponde ao nome do domínio do endereço de e-mail. Explicando cada elemento:

                [A-Za-z0-9.-]: Isso define um conjunto de caracteres permitidos para o nome do domínio. É semelhante ao conjunto de caracteres do nome do usuário, permitindo letras maiúsculas e minúsculas, dígitos numéricos e os caracteres de ponto (.) e hífen (-).
                +: Assim como no nome do usuário, o sinal de mais indica que o conjunto de caracteres pode ocorrer uma ou mais vezes. Isso permite que o nome do domínio do endereço de e-mail tenha mais de um caractere.
                \.: Isso corresponde a um ponto (.) literal. O ponto é um caractere especial na expressão regular, então é necessário escapá-lo com uma barra invertida () para corresponder a um ponto literal.

            
            [A-Z|a-z]{2,}: Essa parte corresponde à extensão do domínio do endereço de e-mail. Explicando cada elemento:

                [A-Z|a-z]: Isso define um conjunto de caracteres permitidos para a extensão do domínio. Inclui letras maiúsculas (de A a Z) e letras minúsculas (de a a z).
                {2,}: Isso indica que o conjunto de caracteres deve ocorrer duas ou mais vezes. Isso garante que a extensão do domínio tenha pelo menos duas letras.

            
            \b: Assim como no início da expressão regular, o limite de palavra é usado para garantir que o padrão de e-mail seja correspondido como uma palavra inteira.
         */
        const regexEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        //--------------------------------------------

        //Verifica se existe algum email na string
        const matches = str.match(regexEmail);
        if (matches) {
            for (const match of matches) {
                //Verifica se o email é de exemplo
                if (match.toLowerCase().includes('example')) {
                    continue;
                }

                //Valida o email
                await Valida_servidor_email(match).then((result) => {
                    let valida_email = "";

                    if (result[0].isValid && result[0].exists) {
                        valida_email = "Valido e existente";
                    }
                    else if (result[0].isValid) {
                        valida_email = "Valido";
                    }
                    else if (result[0].exists) {
                        valida_email = "Existente";
                    }
                    else {
                        valida_email = "Invalido";
                    }

                    emailsValidos.push(match+"|"+valida_email);
                });
            }
        }    

        //Retorna os emails válidos
        resolve(emailsValidos.join(", ").removerDuplicatas().toString().trim().toUpperCase());
    });

}


async function Analisa_texto(texto){
    return new Promise(async function (resolve, reject) {
        console.log('Analisando texto...');

        //-----------Valida telefones-----------
        const telefonesPromise = Valida_telefone(texto);

        //-----------Valida emails-----------
        const emailsPromise = Valida_email(texto);

        const [telefones, emails] = await Promise.all([telefonesPromise, emailsPromise]);

        console.log('Análise completa');

        //Retorna os telefones e emails válidos
        resolve({ telefones: telefones, emails: emails });
    });
}

async function Busca_empresa() {
    return new Promise(async function (resolve, reject) {
        let arr_dados_bd = [];

        //Busca os dados no banco de dados. É importante saber o nome das colunas, você precisará disso depois. Nesse caso, as colunas são: registro_id, razao_social e cnpj (não precisa ser nessa ordem). Caso queira testar, pode usar o  limit.
        await sequelize.query("select group_concat(registro_id) as registro_id, razao_social, cnpj from tabelaX group by razao_social, cnpj", {type: sequelize.QueryTypes.SELECT}).then(async function (dados) {
            arr_dados_bd = dados;
        }).catch(function (erro) {
            console.log("Falha ao se conectar: " + erro);
        });
        //--------------------------------------------

        const array_final = [];


        for(let i of arr_dados_bd) {
            if(i.razao_social){
                //Busca os dados no google. É importante que você use os nomes exatos das colunas que vieram da sua tabela aqui. Nesse caso, as colunas são: registro_id, razao_social e cnpj.
                const dados_google = await Busca_empresa_google(i.registro_id,"\""+(i.razao_social.toString().trim())+"\"", i.cnpj).then((dg) => {return dg;});
                //--------------------------------------------

                if(dados_google.length > 0){
                    array_final.push(dados_google);
                }
            }
        }

        const gws = await new Promise(async (resolve,reject) => {
            //Busca os dados dentro dos sites retornados pelo google.
            for(let i of array_final){
                console.log("\nBuscando dados da empresa: "+i[0].razao_social+"\n");
                await Go_Web_Scrapping(i);
            }
            //--------------------------------------------

            resolve(['success']);
        });
        
        //Monta o arquivo excel com os dados encontrados.
        await Promise.all([gws]).then(async function (e) {
            await Monta_excel();
            console.log("Busca finalizada");
        }).catch(async e=>{
            await Monta_excel();
            console.log(e);
        });
    });
}

async function Busca_empresa_google(id,dados_pesquisa,cnpj) {
    /*
     *  ----------------Busca os dados no google------------------
        É importante que o arquivo google-search.json seja alterado, adicione as suas credenciais. 
        Você pode gerar a credencial searchEngineId em: https://programmablesearchengine.google.com/controlpanel/create
        E pode gerar a credencial apiKey em https://console.developers.google.com/apis/credentials

        A api usada aqui é a Custom Search API. Lembre-se de ativá-la.

        O limite gratuíto da api é de 100 requisições. Ou seja, 100 pesquisas.
    */

    const array_dados_to_scraping = [];

    return new Promise(async function (resolve, reject) {
        try{
            customsearch.cse.list({
                auth: googleSearchCredentials.apiKey,
                cx: googleSearchCredentials.searchEngineId,
                q: (cnpj ? "\""+cnpj+"\"" : dados_pesquisa)
            }, async (err, res) => {
                //Verifica se houve algum erro
                if(err) return console.error(err);

                if(res.data.items){
                    for(let item of res.data.items) {

                        //Verifica se o arquivo é um pdf ou xls, se for, pula para o próximo.
                        if(item.mime && (item.mime == "application/pdf" || item.mime == "application/xls" || item.mime == "application/xlsx")) continue;

                        //Analisa o texto do snippet
                        const texto_analisado_snippet = await Analisa_texto(item.snippet.toString());
                        
                        await Promise.all([texto_analisado_snippet]).then(texto_analisado => {return texto_analisado[0]}).then(texto_analisado => {
                            let count_elementos = 0;
                            
                            if(texto_analisado.telefones || texto_analisado.emails){
                                if(!array_dados[id]) array_dados[id] = [];
                                else{
                                    //Verifica se o telefone ou email já existe no array
                                    for(let i of array_dados[id]) {
                                        const telefoneLowerCase = texto_analisado.telefones.toString().trim().toLowerCase();
                                        const emailLowerCase = texto_analisado.emails.toString().trim().toLowerCase();
                                        const telefoneExist = telefoneLowerCase && i.telefone.toString().trim().toLowerCase().indexOf(telefoneLowerCase) > -1;
                                        const emailExist = emailLowerCase && i.email.toString().trim().toLowerCase().indexOf(emailLowerCase) > -1;
                                        
                                        if ((telefoneLowerCase && telefoneExist) ||
                                            (emailLowerCase && emailExist)){
                                            count_elementos++;
                                            break;
                                        }
                                    }
                                }
                                
                                if (count_elementos === 0) {
                                    array_dados[id].push({
                                        id: id,
                                        razao_social: dados_pesquisa.toLowerCase().replaceAll("\"",""),
                                        telefone: texto_analisado.telefones,
                                        email: texto_analisado.emails,
                                        url: item.link,
                                        cnpj: cnpj,
                                    });
                                }
                            }
                        }).catch(e=>{
                            console.log(e);
                        });

                        array_dados_to_scraping.push({id:id,razao_social:dados_pesquisa.toLowerCase().replaceAll("\"",""), url:item.link, cnpj:cnpj});
                        
                    }
                } else {
                    resolve([]);
                }
                
                resolve(array_dados_to_scraping);
            });
        }catch(e){
            console.log(e);
        }
    });
}

async function Go_Web_Scrapping(arr=null,iter=0){
    return await new Promise(async function (resolve) {
        let id, url, razao_social, cnpj;
    
        if(!arr) return arr;
        else if(arr[iter]){
            id = arr[iter].id;
            url = arr[iter].url;
            razao_social = arr[iter].razao_social;
            cnpj = arr[iter].cnpj;
        }

        if(iter < arr.length) {
            console.log("Buscando dados... "+(iter+1)+" de "+arr.length)
            iter++;
        }
        else {
            resolve([iter]);
        }
    
        if(id){
            const sp = await new Promise((resolve) => {
                resolve(Scraping(id,url,razao_social,cnpj));
            });
            await Promise.all([sp]).then(async function (e) {
                if(arr){
                    if(iter < arr.length) {
                        return await new Promise((resolve) => {
                            resolve(Go_Web_Scrapping(arr,iter));
                        }).then((e)=>{
                            return arr;
                        }).catch(e=>{
                            return arr;
                        });
                    }
    
                    return arr;
                }
            });
        }
    
        resolve([iter]);
    });
}

async function Iniciar_navegador(){
    let navegador;

	try {
	    console.log("Iniciando navegador...");

        /*
            ---------------------Explicações dos parâmetros---------------------

            headless: true: Esse argumento define se o navegador será iniciado em modo headless, ou seja, sem exibir a interface gráfica do navegador. No caso, está definido como true, o que significa que o navegador será executado sem interface gráfica.

            args: ["--disable-setuid-sandbox", "--fast-start", "--disable-extensions", "--no-sandbox"]: Esses argumentos são opções do Chromium que estão sendo passadas para o navegador lançado pelo Puppeteer. Vejamos o significado de cada um deles:

            --disable-setuid-sandbox: Desativa o uso do sandbox de execução. O sandbox é um mecanismo de segurança para restringir o acesso não autorizado do navegador a recursos do sistema.
            --fast-start: Inicia o navegador mais rapidamente, ignorando algumas verificações de rede.
            --disable-extensions: Desativa a instalação de extensões de navegador.
            --no-sandbox: Executa o navegador sem o sandbox. Da mesma forma que --disable-setuid-sandbox, essa opção é usada em ambientes em que o sandbox não está disponível ou precisa ser desabilitado.

            'ignoreHTTPSErrors': true: Esse argumento indica que erros de segurança relacionados ao HTTPS serão ignorados. Em algumas situações, pode ser necessário desabilitar a verificação de certificados SSL, mas é importante ter em mente os riscos envolvidos ao fazer isso.
        */
	    navegador = await puppeteer.launch({
	        headless: true,
	        args: ["--disable-setuid-sandbox","--fast-start", "--disable-extensions", "--no-sandbox"],
	        'ignoreHTTPSErrors': true
	    });
        //---------------------------------------------------------------------

	} catch (err) {
	    console.log("Um erro foi encontrado => ", err);
	}
	return navegador;
}

async function Scraping(id, url, razao_social, cnpj) {
    return new Promise(async function (resolve, reject) {
        try {
            //Inicia o navegador
            const navegador = await Iniciar_navegador();

            //Abre uma nova guia
            const page = await navegador.newPage();

            console.log(`Coletando informações: ${url}...`);

            //Acessa a url
            await page.goto(url);
            
            let arr_texto = [];

            //Pega o texto de todos os elementos
            for(let i of elementos){
                const eval_text = await page.$$eval(i, el => {
                    return el.map((e) =>  e.textContent);
                });
                if(eval_text){
                    arr_texto.push(eval_text);
                }
            }

            let texto = arr_texto.join(' ');
            if(texto){

                //Analisa o texto
                const texto_analisado_bruto = await Analisa_texto(texto);

                //Pega os telefones e emails
                await Promise.all([texto_analisado_bruto]).then((texto_analisado) => { return texto_analisado[0] }).then(async (texto_analisado) => {
                    let count_elementos = 0;
                    if (texto_analisado.telefones || texto_analisado.emails) {
                        if (!array_dados[id]) array_dados[id] = [];
                        else {
                            //Verifica se o telefone ou email já existe no array
                            for(let i of array_dados[id]) {
                                const telefoneLowerCase = texto_analisado.telefones.toString().trim().toLowerCase();
                                const emailLowerCase = texto_analisado.emails.toString().trim().toLowerCase();
                                const telefoneExist = telefoneLowerCase && i.telefone.toString().trim().toLowerCase().indexOf(telefoneLowerCase) > -1;
                                const emailExist = emailLowerCase && i.email.toString().trim().toLowerCase().indexOf(emailLowerCase) > -1;
                    
                                if ((telefoneLowerCase && telefoneExist) ||
                                    (emailLowerCase && emailExist)){
                                    count_elementos++;
                                    break;
                                }
                            }
                        }
                        
                        //Se não existir, adiciona no array
                        if (count_elementos === 0) {
                            array_dados[id].push({
                                id: id,
                                razao_social: razao_social,
                                telefone: texto_analisado.telefones,
                                email: texto_analisado.emails,
                                url: url,
                                cnpj: cnpj,
                            });
                        }
                    }
                });
            }

            //Fecha o navegador
            await navegador.close();

            //Retorna o array
            resolve(array_dados);
        } catch (err) {
            console.log(`\nNão foi possível realizar o acesso no site ${url}. Erro: ${err}\n`);
            resolve([]);
        }
    });	
}

async function Monta_excel() {
    return new Promise(async function (resolve, reject) {
        let data = new Date();
        data = data.getDate()+"-"+(data.getMonth()+1)+"-"+data.getFullYear()+"_"+data.getHours()+"-"+data.getMinutes()+"-"+data.getSeconds();

        console.log("Gerando planilha...");

        const Excel = require('../buscar_telefones/node_modules/excel4node');
        const create_workbook = new Excel.Workbook();
        const workbook = create_workbook.addWorksheet('Telefones');

        const cabecalho = ['IDs', 'Razão Social', 'Telefones', 'Emails existentes e com servidor válido', 'Emails com servidor válido', 'Emails existentes', 'Emails inválidos', 'Site', 'CNPJ'];

        for(let item of cabecalho) {
            workbook.cell(1, cabecalho.indexOf(item)+1).string(item);
        }

        let primeira_linha = 2;

        for(let item of array_dados) {
            if(!item) continue;

            for(let i of item) {
                if(!i) continue;
                let coluna = 1;

                for(let e in i) {
                    let arr_emails_existentes_e_validos = [];
                    let arr_emails_validos = [];
                    let arr_emails_existentes = [];
                    let arr_emails_invalidos = [];

                    if(e == "email"){
                        if(i[e]){
                            let arr_emails_bruto = i[e].split(", ");

                            for(let em of arr_emails_bruto) {
                                em = em.trim().split("|");

                                if(em[1] == "VALIDO E EXISTENTE") arr_emails_existentes_e_validos.push(em[0]);
                                else if(em[1] == "VALIDO") arr_emails_validos.push(em[0]);
                                else if(em[1] == "EXISTENTE") arr_emails_existentes.push(em[0]);
                                else if(em[1] == "INVALIDO") arr_emails_invalidos.push(em[0]);
                            }
                        }
                        arr_emails_existentes_e_validos.join(", ");
                        arr_emails_validos.join(", ");
                        arr_emails_existentes.join(", ");
                        arr_emails_invalidos.join(", ");

                        arr_emails_existentes_e_validos = arr_emails_existentes_e_validos ? arr_emails_existentes_e_validos : " ";
                        arr_emails_validos = arr_emails_validos ? arr_emails_validos : " ";
                        arr_emails_existentes = arr_emails_existentes ? arr_emails_existentes : " ";
                        arr_emails_invalidos = arr_emails_invalidos ? arr_emails_invalidos : " ";
                        
                        workbook.cell(primeira_linha, coluna++).string(''+arr_emails_existentes_e_validos+'');
                        workbook.cell(primeira_linha, coluna++).string(''+arr_emails_validos+'');
                        workbook.cell(primeira_linha, coluna++).string(''+arr_emails_existentes+'');
                        workbook.cell(primeira_linha, coluna++).string(''+arr_emails_invalidos+'');
                    }
                    else {
                        if(Number.isInteger(i[e])){
                            workbook.cell(primeira_linha, coluna++).number(i[e] ? i[e] : 0);
                        } else {
                            workbook.cell(primeira_linha, coluna++).string(''+(i[e] ? i[e] : " ")+'');
                        }
                    }
                }
                primeira_linha++;
            }
        }

        create_workbook.write('telefones__'+data+'.xlsx');
        
        console.log("Planilha gerada com sucesso");
    });
}

async function Inicia() {
    await Busca_empresa();
}

Inicia();