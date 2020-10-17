const url = require('url')
const MongoClient = require('mongodb').MongoClient

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
        case 'GET': // get user ID of an address, returns empty string if not in-network
            const { address = "" } = req.query;
            if (address.length < 3) { res.status(400).send("invalid address"); return; }
            
            var db = await connectToDatabase(process.env.MONGODB_URI);
            var collection = db.collection('taidl_address');

            var q = { address: address };
            console.log(address);
            collection.findOne(q, (err, result) => {
                console.log("result", result);
                if (err) {
                    res.status(400).json(err);
                }
                else {
                    if (!result) {
                        res.status(400).send("not found");
                        return;
                    }
                    if (result.isAnonymous) {
                        res.status(200).send("Taidl User");
                    }
                    else {
                        res.status(200).send(result.owner);
                    }
                }
            })
            break;
        case 'POST': // set anonymous property
            const {body} = req;
            if (!body || !body.address || (body.isAnonymous === undefined)) { res.status(400).send("incomplete data"); return; }

            var db = await connectToDatabase(process.env.MONGODB_URI);
            var collection = db.collection('taidl_address');

            var q = { address: body.address};
            collection.findOne(q, (err, result) => {
                if (err) {
                    res.status(400).json(err);
                }
                else {
                    if (!result) {
                        res.status(400).send("invalid address");
                        return;
                    }
                    if (result.isAnonymous != body.isAnonymous) {
                        collection.updateOne(q, {$set: {isAnonymous: body.isAnonymous}}, (err, result) => {
                            if (err) { res.status(400).json(err); return; }
                            res.status(200).send("success");
                        })
                    }
                    else {
                        res.status(200).send("no change");
                    }
                }
            })
            break;
        default:
            res.status(400).send();
            return;
  }
}
