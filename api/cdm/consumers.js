const url = require('url')
const MongoClient = require('mongodb').MongoClient
const axios = require('axios')

import { XDAI_MOCK_URI } from '../config'

let cachedDb = null

async function connectToDatabase(uri) {
  if (cachedDb) {
    return cachedDb
  }
  const client = await MongoClient.connect(uri, { useNewUrlParser: true })
  const db = await client.db("geo")
  cachedDb = db
  return db
}

module.exports = async (req, res) => {
  switch(req.method) {
        case 'OPTIONS': // handle CORS
            res.status(200).end();
            return;
        case 'GET': // get primary address of a user
            const { userId = "" } = req.query;
            if (userId.length < 1) { res.status(400).send(); return; }
            
            var db = await connectToDatabase(process.env.MONGODB_URI);
            var collection = db.collection('taidl_user');

            var q = { userId: userId };
            collection.findOne(q, (err, result) => {
                if (err) {
                    res.status(400).json(err);
                }
                else {
                    console.log(result);
                    if (result && result.primaryAddress) { res.status(200).send(result.primaryAddress); }
                    else { res.status(400).send("no result"); }
                }
            })
            return;
        case 'POST': // create a new user or update user information
            const {body} = req;
            if (!body || !body.userId || !body.password) { res.status(400).send("incomplete data"); return; }

            var db = await connectToDatabase(process.env.MONGODB_URI);
            if (body.address) {
                // add an address to the user
                // TODO
            }
            else {
                // new user
                var q = { userId: body.userId};

                var collection = db.collection('taidl_user');
                collection.findOne(q, (err, result) => {
                    if (err) { res.status(400).json(err); return; }
                    if (result) {
                        res.status(400).send("user already exists");
                        return;
                    }

                    axios.get(XDAI_MOCK_URI + "generateWallet").then(response => {
                        q = {userId: body.userId, password: body.password, email: body.email, 
                        primaryAddress: response.data, addresses: [response.data]};

                        console.log("new user", q);

                        collection.insertOne(q, (err, result) => {
                            if (err) { res.status(400).json(err); return; }

                            // save to wallet db
                            var col = db.collection('taidl_address');
                            col.insertOne({address: response.data, isAnonymous: false}, (err, result) => {
                                if (err) { res.status(400).json(err); return; }
                                res.status(200).send("success");
                            })
                        });
                    }).catch(function(e) { res.status(400).json(e); return; })
                })
            }
            break;
        default:
            res.status(400).send();
            return;
  }
}
